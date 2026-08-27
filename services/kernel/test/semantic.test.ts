import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { SemanticMemory } from "../src/memory/semantic.js";
import { EpisodicMemory } from "../src/memory/episodes.js";
import type { AuditLog } from "../src/core/audit.js";

const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";

let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* skip */
}

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

/**
 * Deterministic 768-dim embedder — a test double for the embedding FUNCTION only
 * (bag-of-words hashed into the vector, L2-normalized). It is NOT a learned model,
 * so it has no real semantics; but it gives a stable ranking signal (texts sharing
 * words are closer), which is exactly what's needed to verify the REAL storage +
 * pgvector cosine-search mechanics. The production path swaps this for the gateway
 * embeddings role (nomic-embed-text) with no code change.
 */
function hashEmbed(text: string): number[] {
  const v = new Array(768).fill(0);
  for (const tok of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
    v[h % 768] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
const embed = async (texts: string[]) => texts.map(hashEmbed);

describe.skipIf(!pool)("SemanticMemory (vector recall over pgvector)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_embeddings CASCADE");
    await pool!.query("TRUNCATE memory_episodes CASCADE");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("indexes vectors and ranks the nearest by cosine distance", async () => {
    const sm = new SemanticMemory(pool!, embed);
    const reactor = randomUUID();
    const meeting = randomUUID();
    const garden = randomUUID();
    expect(await sm.index("episode", reactor, "calibrated the arc reactor palladium core")).toBe(true);
    expect(await sm.index("episode", meeting, "scheduled a board meeting with Pepper")).toBe(true);
    expect(await sm.index("episode", garden, "watered the rooftop garden plants")).toBe(true);
    expect(await sm.count()).toBe(3);

    const hits = await sm.search("what did we do with the reactor core", { kinds: ["episode"], limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.sourceId).toBe(reactor); // the reactor episode is nearest
    // distances are ordered ascending (nearest first)
    for (let i = 1; i < hits.length; i++) expect(hits[i]!.distance).toBeGreaterThanOrEqual(hits[i - 1]!.distance);
  });

  it("upserts on re-index (one row per item+model) and removes on demand", async () => {
    const sm = new SemanticMemory(pool!, embed);
    const id = randomUUID();
    await sm.index("episode", id, "first text");
    await sm.index("episode", id, "second text about reactors");
    expect(await sm.count()).toBe(1); // upsert, not duplicate
    await sm.remove("episode", id);
    expect(await sm.count()).toBe(0);
    expect(await sm.search("reactors")).toEqual([]);
  });

  it("degrades gracefully when the embedder is unavailable (no throw, lexical fallback upstream)", async () => {
    const broken = new SemanticMemory(pool!, async () => {
      throw new Error("no embedding provider eligible");
    });
    expect(await broken.available()).toBe(false);
    expect(await broken.index("episode", randomUUID(), "text")).toBe(false); // no-op, no throw
    expect(await broken.search("anything")).toEqual([]);
  });

  it("skips a dimension mismatch rather than corrupting the index", async () => {
    const wrongDim = new SemanticMemory(pool!, async (texts) => texts.map(() => [0.1, 0.2, 0.3])); // 3 != 768
    expect(await wrongDim.index("episode", randomUUID(), "text")).toBe(false);
    expect(await wrongDim.count()).toBe(0);
  });

  it("EpisodicMemory.semanticRecall recalls by MEANING (auto-indexed on record)", async () => {
    const sm = new SemanticMemory(pool!, embed);
    const mem = new EpisodicMemory(pool!, audit, undefined, sm);
    await mem.record({ summary: "calibrated the arc reactor palladium core", provenance: "test" });
    await mem.record({ summary: "scheduled a board meeting with Pepper", provenance: "test" });
    await mem.record({ summary: "watered the rooftop garden plants", provenance: "test" });
    expect(await sm.count()).toBe(3); // each record auto-indexed

    // query shares no exact substring with the summary ("reactor core" vs "arc reactor palladium core")
    const hits = await mem.semanticRecall("the reactor core work", 3);
    expect(hits[0]!.summary).toContain("arc reactor"); // meaning-nearest first
  });

  it("EpisodicMemory.semanticRecall falls back to lexical when no embedder", async () => {
    const broken = new SemanticMemory(pool!, async () => {
      throw new Error("down");
    });
    const mem = new EpisodicMemory(pool!, audit, undefined, broken);
    await mem.record({ summary: "calibrated the arc reactor", provenance: "test" });
    await mem.record({ summary: "board meeting", provenance: "test" });
    // no embedder → semanticRecall returns lexical substring matches, never empty/error
    const hits = await mem.semanticRecall("reactor", 5);
    expect(hits.map((h) => h.summary)).toContain("calibrated the arc reactor");
  });
});
