import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EpisodicMemory } from "../src/memory/episodes.js";
import { EntityMemory } from "../src/memory/entities.js";
import { Vault } from "../src/crypto/vault.js";
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
const vault = await Vault.open(
  join(tmpdir(), `jarvis-epi-test-${randomBytes(6).toString("hex")}.json`),
  randomBytes(32),
).catch(() => undefined);

describe.skipIf(!pool)("EpisodicMemory (recallable timeline)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_episodes CASCADE");
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations CASCADE");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("records an event and recalls it newest-first", async () => {
    const mem = new EpisodicMemory(pool!, audit, vault);
    await mem.record({ summary: "Deployed the arc reactor", kind: "milestone", provenance: "test" });
    await mem.record({ summary: "Edited config.ts", kind: "action", tags: ["Files"], provenance: "test" });

    const timeline = await mem.timeline();
    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.summary).toBe("Edited config.ts"); // newest first
    expect(timeline[0]!.tags).toEqual(["files"]); // lowercased
    expect(timeline[1]!.kind).toBe("milestone");
  });

  it("encrypts summary + detail at rest (DB holds ciphertext, 0 plaintext)", async () => {
    if (!vault) return;
    const mem = new EpisodicMemory(pool!, audit, vault);
    await mem.record({ summary: "Secret plan", detail: "the very private detail", provenance: "test" });
    const raw = await pool!.query("SELECT summary, detail FROM memory_episodes");
    expect(raw.rows[0].summary).toMatch(/^v1\.gcm\./);
    expect(raw.rows[0].detail).toMatch(/^v1\.gcm\./);
    const all = JSON.stringify(raw.rows);
    expect(all).not.toContain("Secret plan");
    expect(all).not.toContain("the very private detail");
    // …but it round-trips in the clear on read
    const t = await mem.timeline();
    expect(t[0]!.summary).toBe("Secret plan");
    expect(t[0]!.detail).toBe("the very private detail");
  });

  it("redacts secret-shaped content instead of rejecting it (R-MEM-06, never breaks the loop)", async () => {
    const mem = new EpisodicMemory(pool!, audit, vault);
    // An API-key-shaped token embedded in an auto-recorded summary must not persist
    // raw — episodes are frequently auto-recorded from activity, so this REDACTS
    // (masks) rather than throwing (which would break the loop).
    const e = await mem.record({
      summary: "ran a command, output sk-ABCDEFGHIJKLMNOP0123456789",
      provenance: "tool:test",
    });
    expect(e.summary).toContain("<REDACTED>");
    expect(e.summary).not.toContain("sk-ABCDEFGHIJKLMNOP0123456789");
    // and the decrypted-on-read value is redacted too (never surfaces the token)
    const back = await mem.timeline();
    expect(back[0]!.summary).not.toContain("sk-ABCDEFGHIJKLMNOP0123456789");
  });

  it("filters by free-text query, kind, tag, and since", async () => {
    const mem = new EpisodicMemory(pool!, audit, vault);
    const early = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    await mem.record({ summary: "Booted the kernel", kind: "observation", tags: ["system"], provenance: "test", occurredAt: early });
    await mem.record({ summary: "Wrote a design note about voices", kind: "note", tags: ["design"], provenance: "test" });
    await mem.record({ summary: "Decided to ship Fable voice", kind: "decision", tags: ["design"], provenance: "test" });

    expect((await mem.recall({ query: "voice" })).map((e) => e.kind).sort()).toEqual(["decision", "note"]);
    expect((await mem.recall({ kind: "decision" }))).toHaveLength(1);
    expect((await mem.recall({ tag: "design" }))).toHaveLength(2);
    const recent = await mem.recall({ since: new Date(Date.now() - 5 * 60 * 1000) }); // last 5 min
    expect(recent.map((e) => e.summary)).not.toContain("Booted the kernel"); // the 1h-old one is excluded
  });

  it("links an episode to a known entity and recalls by entity name", async () => {
    const ents = new EntityMemory(pool!, audit, vault);
    await ents.rememberEntity({ kind: "project", name: "Mark VII", provenance: "test" });
    const mem = new EpisodicMemory(pool!, audit, vault);
    await mem.record({ summary: "Ran a flight test", kind: "action", entityName: "Mark VII", provenance: "test" });
    await mem.record({ summary: "Unrelated event", provenance: "test" });

    const linked = await mem.recall({ entityName: "mark vii" }); // case-insensitive
    expect(linked).toHaveLength(1);
    expect(linked[0]!.entity_name).toBe("Mark VII");
    // recall for an unknown entity returns nothing (never throws)
    expect(await mem.recall({ entityName: "Nonexistent" })).toEqual([]);
  });

  it("forget soft-deletes an episode — excluded from recall immediately", async () => {
    const mem = new EpisodicMemory(pool!, audit, vault);
    const e = await mem.record({ summary: "A regrettable event", provenance: "test" });
    expect(await mem.timeline()).toHaveLength(1);
    expect(await mem.forget(e.id)).toBe(true);
    expect(await mem.timeline()).toHaveLength(0);
    expect(await mem.forget(e.id)).toBe(false); // idempotent — already gone
  });

  it("recentForContext returns only non-sensitive events, importance-ordered", async () => {
    const mem = new EpisodicMemory(pool!, audit, vault);
    await mem.record({ summary: "public low", importance: 0.2, sensitivity: "public", provenance: "test" });
    await mem.record({ summary: "personal high", importance: 0.9, sensitivity: "personal", provenance: "test" });
    await mem.record({ summary: "private secret event", importance: 1.0, sensitivity: "private", provenance: "test" });

    const ctx = await mem.recentForContext(5);
    const summaries = ctx.map((e) => e.summary);
    expect(summaries).toContain("personal high");
    expect(summaries).toContain("public low");
    expect(summaries).not.toContain("private secret event"); // sensitive excluded
    expect(summaries[0]).toBe("personal high"); // importance-ordered
  });
});
