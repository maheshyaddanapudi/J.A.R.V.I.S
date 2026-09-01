import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { EntityMemory } from "../src/memory/entities.js";
import type { SemanticMemory } from "../src/memory/semantic.js";
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

afterAll(async () => {
  await pool?.end();
});

/** A vector layer that always ranks the NEIGHBOUR first — the exact failure
 *  Longitude-XL measured ('optics vendor' for 'optics vendor two'). */
function neighbourFirst(p: pg.Pool, neighbourNames: string[]): SemanticMemory {
  const stub = {
    available: async () => true,
    count: async () => 1,
    index: async () => undefined,
    remove: async () => undefined,
    async search() {
      const { rows } = await p.query<{ id: string; name: string }>(
        `SELECT id, name FROM memory_entities WHERE status NOT IN ('deleted','superseded')`,
      );
      return neighbourNames
        .map((n) => rows.find((r) => r.name === n))
        .filter(Boolean)
        .map((r, i) => ({ sourceKind: "entity" as const, sourceId: r!.id, score: 0.9 - i * 0.1, model: "stub" }));
    },
  };
  return stub as unknown as SemanticMemory;
}

describe.skipIf(!pool)("D-0080 S1 — identity-first graph recall (R-MEM-07)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings CASCADE");
  });
  async function seedVendors(mem: EntityMemory) {
    await mem.rememberEntity({ kind: "vendor", name: "optics vendor", provenance: "t" });
    await mem.rememberFact({ entityName: "optics vendor", statement: "optics vendor's assigned number is 7", provenance: "t" });
    await mem.rememberEntity({ kind: "vendor", name: "optics vendor two", provenance: "t" });
    await mem.rememberFact({ entityName: "optics vendor two", statement: "optics vendor two's assigned number is 24", provenance: "t" });
  }

  it("neighbour precision: the entity NAMED in the query seeds first, even when vectors rank its neighbour higher", async () => {
    const mem = new EntityMemory(pool!, audit, undefined, neighbourFirst(pool!, ["optics vendor", "optics vendor two"]));
    await seedVendors(mem);
    const r = await mem.recallGraph("what is optics vendor two's assigned number");
    expect(r.seeds[0]).toEqual({ name: "optics vendor two", via: "identity" });
    expect(r.entities[0].name).toBe("optics vendor two");
    expect(r.entities[0].facts.join(" ")).toContain("24");
    expect(r.mode).toBe("hybrid");
  });

  it("specificity: the longest matching name wins; shorter containing names still seed, after it", async () => {
    const mem = new EntityMemory(pool!, audit);
    for (const n of ["roof array", "roof array two", "roof array north"]) {
      await mem.rememberEntity({ kind: "device", name: n, provenance: "t" });
    }
    const r = await mem.recallGraph("where is the roof array north located");
    const names = r.seeds.map((s) => s.name);
    expect(names[0]).toBe("roof array north");
    expect(names).toContain("roof array");
    expect(names).not.toContain("roof array two");
  });

  it("common-word guard: a short single-token name does not seed from inside another word; a two-token name does", async () => {
    const mem = new EntityMemory(pool!, audit);
    await mem.rememberEntity({ kind: "device", name: "kiln", provenance: "t" });
    await mem.rememberEntity({ kind: "device", name: "weather mast", provenance: "t" });
    const r = await mem.recallGraph("the kilning run and the weather mast reading");
    const names = r.seeds.map((s) => s.name);
    expect(names).toContain("weather mast");
    expect(names).not.toContain("kiln");
  });

  it("offline parity: with no embedder, identity seeding still works and reports lexical mode", async () => {
    const mem = new EntityMemory(pool!, audit);
    await mem.rememberEntity({ kind: "thing", name: "arc reactor", provenance: "t" });
    await mem.rememberFact({ entityName: "arc reactor", statement: "the arc reactor runs on palladium", provenance: "t" });
    const r = await mem.recallGraph("tell me about the arc reactor");
    expect(r.mode).toBe("lexical");
    expect(r.seeds[0]).toEqual({ name: "arc reactor", via: "identity" });
    expect(r.entities[0].facts.join(" ")).toContain("palladium");
  });

  it("knob off restores similarity-first (the pre-D-0080 behaviour) for A/B", async () => {
    const mem = new EntityMemory(pool!, audit, undefined, neighbourFirst(pool!, ["optics vendor", "optics vendor two"]));
    mem.identityFirst = async () => false;
    await seedVendors(mem);
    const r = await mem.recallGraph("what is optics vendor two's assigned number");
    expect(r.seeds[0]).toEqual({ name: "optics vendor", via: "similarity" });
    expect(r.mode).toBe("semantic");
  });

  it("nothing matches by name and there is no embedder → the loose word match still finds a candidate (old fallback kept)", async () => {
    const mem = new EntityMemory(pool!, audit);
    await mem.rememberEntity({ kind: "person", name: "Priya Raman", provenance: "t" });
    const r = await mem.recallGraph("anything from raman lately");
    expect(r.seeds.map((s) => s.name)).toContain("Priya Raman");
    expect(r.mode).toBe("lexical");
  });
});

describe.skipIf(!pool)("D-0080 S1 — a seed shows the ASKED fact, not just its newest three", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings CASCADE");
  });
  it("an entity with more than three facts still surfaces the one the question is about", async () => {
    const mem = new EntityMemory(pool!, audit);
    await mem.rememberEntity({ kind: "place", name: "boat shed two", provenance: "t" });
    await mem.rememberFact({ entityName: "boat shed two", statement: "boat shed two's service day is thursday", provenance: "t" });
    for (const s of ["home city is bergen", "status colour is olive", "assigned number is 19", "core material is cedar"]) {
      await mem.rememberFact({ entityName: "boat shed two", statement: `boat shed two's ${s}`, provenance: "t" });
    }
    const r = await mem.recallGraph("what is boat shed two's service day");
    expect(r.entities[0].name).toBe("boat shed two");
    expect(r.entities[0].facts[0]).toContain("thursday"); // ranked first by the asker's words
  });
});
