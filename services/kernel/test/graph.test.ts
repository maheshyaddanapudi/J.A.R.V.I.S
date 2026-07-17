import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { EntityMemory } from "../src/memory/entities.js";
import { EpisodicMemory } from "../src/memory/episodes.js";
import { SemanticMemory } from "../src/memory/semantic.js";
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

// deterministic 768-dim bag-of-words embedder (same double as semantic.test.ts —
// tests the REAL storage + cosine + graph SQL; the gateway swaps in a real model)
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

describe.skipIf(!pool)("Graph-brain memory (D-0045)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings CASCADE");
  });
  afterAll(async () => {
    await pool?.end();
  });

  async function seedChain(mem: EntityMemory) {
    // Tony —builds→ Mark VII —powered_by→ Arc Reactor  (a 2-hop chain)
    await mem.rememberEntity({ kind: "person", name: "Tony Stark", provenance: "test" });
    await mem.rememberEntity({ kind: "project", name: "Mark VII", provenance: "test" });
    await mem.rememberEntity({ kind: "thing", name: "Arc Reactor", provenance: "test" });
    await mem.relate({ fromName: "Tony Stark", toName: "Mark VII", relation: "builds", provenance: "test" });
    await mem.relate({ fromName: "Mark VII", toName: "Arc Reactor", relation: "powered_by", provenance: "test" });
  }

  it("traverse finds 2-hop neighbors at depth 2 but not depth 1 (multi-hop recall)", async () => {
    const mem = new EntityMemory(pool!, audit);
    await seedChain(mem);
    const d1 = await mem.traverse("Tony Stark", 1);
    expect(d1!.nodes.map((n) => n.name)).toContain("Mark VII");
    expect(d1!.nodes.map((n) => n.name)).not.toContain("Arc Reactor"); // 2 hops away
    const d2 = await mem.traverse("Tony Stark", 2);
    expect(d2!.nodes.map((n) => n.name)).toContain("Arc Reactor"); // reachable at depth 2
    const reactor = d2!.nodes.find((n) => n.name === "Arc Reactor");
    expect(reactor!.depth).toBe(2);
    expect(d2!.edges.map((e) => e.relation).sort()).toEqual(["builds", "powered_by"]);
  });

  it("traverse is cycle-safe and works from either end (undirected walk)", async () => {
    const mem = new EntityMemory(pool!, audit);
    await mem.rememberEntity({ kind: "person", name: "A", provenance: "test" });
    await mem.rememberEntity({ kind: "person", name: "B", provenance: "test" });
    await mem.relate({ fromName: "A", toName: "B", relation: "knows", provenance: "test" });
    await mem.relate({ fromName: "B", toName: "A", relation: "works_with", provenance: "test" });
    const g = await mem.traverse("B", 3); // cycle A<->B must terminate
    expect(g!.nodes).toHaveLength(2);
    expect(await mem.traverse("Nobody", 2)).toBeNull();
  });

  it("auto-links an episode to a known entity mentioned in its text (D-0045)", async () => {
    const ents = new EntityMemory(pool!, audit);
    await ents.rememberEntity({ kind: "project", name: "Mark VII", provenance: "test" });
    const epi = new EpisodicMemory(pool!, audit);
    const e = await epi.record({ summary: "Ran a thruster test on the Mark VII prototype", provenance: "test" });
    expect(e.entity_id).not.toBeNull();
    const linked = await epi.recall({ entityName: "Mark VII" });
    expect(linked.map((x) => x.id)).toContain(e.id);
    // no false link when nothing matches
    const e2 = await epi.record({ summary: "Watered the plants", provenance: "test" });
    expect(e2.entity_id).toBeNull();
  });

  it("entities + facts are vector-indexed on remember and scrubbed on forget", async () => {
    const sm = new SemanticMemory(pool!, embed);
    const mem = new EntityMemory(pool!, audit, undefined, sm);
    await mem.rememberEntity({ kind: "person", name: "Pepper Potts", attributes: "CEO", provenance: "test" });
    await mem.rememberFact({ entityName: "Pepper Potts", statement: "Runs Stark Industries", provenance: "test" });
    await new Promise((r) => setTimeout(r, 150)); // indexing is fire-and-forget
    expect(await sm.count()).toBe(2); // 1 entity + 1 fact
    await mem.forgetEntity("Pepper Potts");
    await new Promise((r) => setTimeout(r, 150));
    expect(await sm.count()).toBe(0); // forget scrubs the vector index too
  });

  it("recallGraph: semantic entry point + one-hop expansion (similar AND connected)", async () => {
    const sm = new SemanticMemory(pool!, embed);
    const mem = new EntityMemory(pool!, audit, undefined, sm);
    await seedChain(mem);
    await mem.rememberFact({ entityName: "Arc Reactor", statement: "palladium core output is 8 gigajoules", provenance: "test" });
    await new Promise((r) => setTimeout(r, 200));
    // query matches the FACT by meaning; expansion must pull in the CONNECTED project
    const r = await mem.recallGraph("palladium core output");
    expect(r.mode).toBe("semantic");
    const names = r.entities.map((e) => e.name);
    expect(names).toContain("Arc Reactor"); // semantic entry point (via its fact)
    expect(names).toContain("Mark VII"); // one hop away — graph expansion
    expect(r.relations.map((x) => x.relation)).toContain("powered_by");
  });

  it("recallGraph falls back to lexical name matching without an embedder", async () => {
    const mem = new EntityMemory(pool!, audit); // no semantic index at all
    await seedChain(mem);
    const r = await mem.recallGraph("tell me about the Mark VII status");
    expect(r.mode).toBe("lexical");
    const names = r.entities.map((e) => e.name);
    expect(names).toContain("Mark VII");
    expect(names).toContain("Tony Stark"); // expansion still works
  });
});
