import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { EntityMemory } from "../src/memory/entities.js";
import { MemoryService } from "../src/memory/memory.js";
import { entityMemoryTools } from "../src/memory/entityTools.js";
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

// ---------------------------------------------------------------------------
// D-0080 S4 — Defect B: a correction reaches the store where the value LIVES.
describe.skipIf(!pool)("D-0080 S4 — route-agnostic memory.correct (R-MEM-08)", () => {
  let mem: EntityMemory;
  let prefs: MemoryService;
  let correct: { run(args: unknown): Promise<{ ok: boolean; summary: string; data?: unknown }> };
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings, preferences CASCADE");
    mem = new EntityMemory(pool!, audit);
    prefs = new MemoryService(pool!, audit);
    correct = entityMemoryTools(mem, prefs).find((t) => t.name === "memory.correct")!;
  });

  it("pref-routed update: the preference is corrected with history, no entity fact is invented", async () => {
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    const r = await correct.run({ entity: "optics vendor two", replaces: "assigned number", newStatement: "optics vendor two's assigned number is 68", value: "68" });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ route: "preference", key: "optics_vendor_two_assigned_number", from: "24", to: "68" });
    expect((await prefs.get("optics_vendor_two_assigned_number"))!.value).toBe("68");
    const history = await prefs.list(true);
    expect(history.filter((p) => p.key === "optics_vendor_two_assigned_number").map((p) => p.status).sort()).toEqual(["superseded", "user_statement"]);
    expect(await mem.listEntities()).toHaveLength(0); // NOT a second home
  });

  it("…also when the entity exists with an unrelated fact: that fact is untouched", async () => {
    await mem.rememberFact({ entityName: "optics vendor two", entityKind: "vendor", statement: "optics vendor two's service day is tuesday", provenance: "t" });
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    const r = await correct.run({ entity: "optics vendor two", replaces: "assigned number", newStatement: "optics vendor two's assigned number is 68", value: "68" });
    expect(r.data).toMatchObject({ route: "preference", to: "68" });
    const facts = (await mem.recall("optics vendor two"))!.facts.map((f) => f.statement);
    expect(facts).toEqual(["optics vendor two's service day is tuesday"]);
    expect((await prefs.get("optics_vendor_two_assigned_number"))!.value).toBe("68");
  });

  it("the attribute in `replaces` picks the right one of several preferences about the subject", async () => {
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    await prefs.remember({ key: "optics_vendor_two_service_day", value: "tuesday", provenance: "chat" });
    const r = await correct.run({ entity: "optics vendor two", replaces: "service day", newStatement: "optics vendor two's service day is friday", value: "friday" });
    expect(r.data).toMatchObject({ route: "preference", key: "optics_vendor_two_service_day" });
    expect((await prefs.get("optics_vendor_two_service_day"))!.value).toBe("friday");
    expect((await prefs.get("optics_vendor_two_assigned_number"))!.value).toBe("24");
  });

  it("ambiguous (several preferences, no attribute hint) → refuses and changes nothing", async () => {
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    await prefs.remember({ key: "optics_vendor_two_service_day", value: "tuesday", provenance: "chat" });
    const r = await correct.run({ entity: "optics vendor two", newStatement: "optics vendor two is now 68", value: "68" });
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/ambiguous/);
    expect((await prefs.list()).map((p) => p.value).sort()).toEqual(["24", "tuesday"]);
    expect(await mem.listEntities()).toHaveLength(0);
  });

  it("a matching entity fact still wins over a same-subject preference (route: fact)", async () => {
    await mem.rememberFact({ entityName: "optics vendor two", entityKind: "vendor", statement: "optics vendor two's assigned number is 24", provenance: "t" });
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    const r = await correct.run({ entity: "optics vendor two", replaces: "assigned number", newStatement: "optics vendor two's assigned number is 68", value: "68" });
    expect(r.data).toMatchObject({ route: "fact", superseded: 1 });
    expect((await mem.recall("optics vendor two"))!.facts.map((f) => f.statement)).toEqual(["optics vendor two's assigned number is 68"]);
    expect((await prefs.get("optics_vendor_two_assigned_number"))!.value).toBe("24"); // never writes the OTHER route
  });

  it("factId keeps the D-0062 contract (exact target; stale id refused, nothing written anywhere)", async () => {
    const f = await mem.rememberFact({ entityName: "optics vendor two", entityKind: "vendor", statement: "optics vendor two's assigned number is 24", provenance: "t" });
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    const bad = await correct.run({ entity: "optics vendor two", factId: "00000000-0000-0000-0000-000000000000", newStatement: "x" });
    expect(bad.ok).toBe(false);
    expect((await prefs.get("optics_vendor_two_assigned_number"))!.value).toBe("24");
    const good = await correct.run({ entity: "optics vendor two", factId: f.id, newStatement: "optics vendor two's assigned number is 68" });
    expect(good.data).toMatchObject({ route: "fact", superseded: 1 });
  });

  // --- mini-life 2026-09-01 regression: the entity's ONLY fact is about a different attribute ---
  it("no factId/replaces: the new statement's own attribute words pick the home — an unrelated single fact is NOT superseded", async () => {
    await mem.rememberFact({ entityName: "kestrel hangar", entityKind: "place", statement: "kestrel hangar's assigned number is 13", provenance: "t" });
    await prefs.remember({ key: "kestrel_hangar_service_day", value: "Friday", provenance: "chat" });
    const r = await correct.run({ entity: "kestrel hangar", newStatement: "kestrel hangar's service day is Saturday", value: "Saturday" });
    expect(r.data).toMatchObject({ route: "preference", key: "kestrel_hangar_service_day", to: "Saturday" });
    expect((await mem.recall("kestrel hangar"))!.facts.map((f) => f.statement)).toEqual(["kestrel hangar's assigned number is 13"]);
  });

  it("a factId whose fact shares nothing with the new statement is REFUSED (nothing written); 'replaces' quoting the old text overrides", async () => {
    const f = await mem.rememberFact({ entityName: "kestrel hangar", entityKind: "place", statement: "kestrel hangar's assigned number is 13", provenance: "t" });
    await prefs.remember({ key: "kestrel_hangar_service_day", value: "Friday", provenance: "chat" });
    const bad = await correct.run({ entity: "kestrel hangar", factId: f.id, newStatement: "kestrel hangar's service day is Saturday", value: "Saturday" });
    expect(bad.ok).toBe(false);
    expect(bad.summary).toMatch(/not about the same thing/);
    expect((await mem.recall("kestrel hangar"))!.facts.map((f) => f.statement)).toEqual(["kestrel hangar's assigned number is 13"]);
    expect((await prefs.get("kestrel_hangar_service_day"))!.value).toBe("Friday");
    // explicit override: the model quotes the old text it means to replace
    const forced = await correct.run({ entity: "kestrel hangar", factId: f.id, replaces: "assigned number is 13", newStatement: "kestrel hangar's service day is Saturday" });
    expect(forced.data).toMatchObject({ route: "fact", superseded: 1 });
  });

  it("'replaces' carrying the entity's own name (the model passed the preference KEY) must not match an unrelated fact by name words alone", async () => {
    await mem.rememberFact({ entityName: "pine shed", entityKind: "place", statement: "pine shed's assigned number is 24", provenance: "t" });
    await prefs.remember({ key: "pine_shed_service_day", value: "Friday", provenance: "chat" });
    // exactly what Sonnet 5 sent in mini-life round C
    const r = await correct.run({ entity: "pine shed", newStatement: "pine shed's service day is Thursday", replaces: "pine_shed_service_day", value: "Thursday" });
    expect(r.data).toMatchObject({ route: "preference", key: "pine_shed_service_day", to: "Thursday" });
    expect((await mem.recall("pine shed"))!.facts.map((f) => f.statement)).toEqual(["pine shed's assigned number is 24"]);
    // …while a 'replaces' that names the attribute still targets the right fact
    const r2 = await correct.run({ entity: "pine shed", newStatement: "pine shed's assigned number is 68", replaces: "pine shed assigned number", value: "68" });
    expect(r2.data).toMatchObject({ route: "fact", superseded: 1 });
    expect((await mem.recall("pine shed"))!.facts.map((f) => f.statement)).toEqual(["pine shed's assigned number is 68"]);
  });

  it("no target named, reworded update sharing a content word still supersedes (D-0060 convenience kept)", async () => {
    await mem.rememberFact({ entityName: "Me", entityKind: "person", statement: "runs at 6am every day", provenance: "t" });
    const r = await correct.run({ entity: "Me", newStatement: "runs at 5:30am" });
    expect(r.data).toMatchObject({ route: "fact", superseded: 1 });
    expect((await mem.recall("Me"))!.facts.map((f) => f.statement)).toEqual(["runs at 5:30am"]);
  });

  it("nothing matches in either store → records a new fact (old behaviour, reported honestly)", async () => {
    await prefs.remember({ key: "coffee_order", value: "cortado", provenance: "chat" });
    const r = await correct.run({ entity: "optics vendor two", replaces: "assigned number", newStatement: "optics vendor two's assigned number is 68" });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ route: "fact", superseded: 0 });
    expect(r.summary).toMatch(/nothing matched to supersede/);
    expect((await mem.recall("optics vendor two"))!.facts).toHaveLength(1);
    expect((await prefs.get("coffee_order"))!.value).toBe("cortado");
  });

  // --- mini-life round D: the agent chose rememberFact for a flip → second home ---
  it("rememberFact refuses an update-in-disguise when a preference already holds that attribute (one home)", async () => {
    const remember = entityMemoryTools(mem, prefs).find((t) => t.name === "memory.rememberFact")!;
    await prefs.remember({ key: "south_beacon_five_service_day", value: "Thursday", provenance: "chat" });
    const r = await remember.run({ entity: "south beacon five", statement: "south beacon five's service day is Tuesday" });
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/memory\.correct/);
    expect(r.summary).toContain("south_beacon_five_service_day");
    expect(await mem.recall("south beacon five")).toBeNull(); // nothing written
    // a statement naming only part of the attribute is a different fact and passes
    const ok = await remember.run({ entity: "south beacon five", statement: "south beacon five needs service next week" });
    expect(ok.ok).toBe(true);
    // and the batch refuses per item
    const batch = entityMemoryTools(mem, prefs).find((t) => t.name === "memory.rememberFacts")!;
    const b = await batch.run({ entity: "south beacon five", statements: ["south beacon five's service day is Tuesday", "south beacon five's core material is cedar"] });
    expect(b.ok).toBe(false);
    const items = (b.data as { items: { stored: boolean; error?: string }[] }).items;
    expect(items.map((it) => it.stored)).toEqual([false, true]);
    expect(items[0]!.error).toMatch(/memory\.correct/);
    expect((await prefs.get("south_beacon_five_service_day"))!.value).toBe("Thursday"); // untouched — correct is the path
  });

  it("without a preference store the tool behaves exactly as before", async () => {
    const legacy = entityMemoryTools(mem).find((t) => t.name === "memory.correct")!;
    await prefs.remember({ key: "optics_vendor_two_assigned_number", value: "24", provenance: "chat" });
    const r = await legacy.run({ entity: "optics vendor two", replaces: "assigned number", newStatement: "optics vendor two's assigned number is 68" });
    expect(r.data).toMatchObject({ route: "fact", superseded: 0 });
    expect((await prefs.get("optics_vendor_two_assigned_number"))!.value).toBe("24");
  });
});

describe.skipIf(!pool)("D-0080 S4 — memory.rememberFacts batch (R-MEM-09)", () => {
  let mem: EntityMemory;
  let batch: { run(args: unknown): Promise<{ ok: boolean; summary: string; data?: unknown; detail?: string; rollback?: () => Promise<void> }> };
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings, preferences CASCADE");
    mem = new EntityMemory(pool!, audit);
    batch = entityMemoryTools(mem).find((t) => t.name === "memory.rememberFacts")!;
  });

  it("stores N statements in one call, each re-read, with per-item factIds", async () => {
    const r = await batch.run({ entity: "tessa novak", kind: "person", statements: ["tessa novak is based in Cusco", "tessa novak meets on Monday", "tessa novak's status colour is olive"] });
    expect(r.ok).toBe(true);
    expect(r.summary).toContain("3/3");
    const items = (r.data as { items: { stored: boolean; factId?: string }[] }).items;
    expect(items.every((it) => it.stored && it.factId)).toBe(true);
    const facts = (await mem.recall("tessa novak"))!.facts.map((f) => f.statement).sort();
    expect(facts).toEqual(["tessa novak is based in Cusco", "tessa novak meets on Monday", "tessa novak's status colour is olive"].sort());
    for (const it of items) expect((await mem.factById(it.factId!))!.statement).toBeTruthy();
  });

  it("a failing item is reported per item and never masked; the others still land", async () => {
    const r = await batch.run({ entity: "tessa novak", kind: "person", statements: ["tessa novak is based in Cusco", "", "tessa novak meets on Monday"] });
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/stored 2 of 3/);
    expect(r.summary).toMatch(/item 2 failed/);
    const items = (r.data as { items: { index: number; stored: boolean; error?: string }[] }).items;
    expect(items.map((it) => it.stored)).toEqual([true, false, true]);
    expect(items[1]!.error).toMatch(/needs a statement/);
    expect((await mem.recall("tessa novak"))!.facts).toHaveLength(2);
    expect(r.detail).toContain("✗");
  });

  it("a secret-shaped statement is refused per item (R-MEM-06) and the rest are kept", async () => {
    const r = await batch.run({ entity: "tessa novak", statements: ["tessa novak meets on Monday", "her token is sk-ant-api03-abcdefghij1234567890"] });
    expect(r.ok).toBe(false);
    const items = (r.data as { items: { stored: boolean; error?: string }[] }).items;
    expect(items[1]!.stored).toBe(false);
    expect(items[1]!.error).toMatch(/secret/);
    expect((await mem.recall("tessa novak"))!.facts.map((f) => f.statement)).toEqual(["tessa novak meets on Monday"]);
  });

  it("rollback forgets exactly what the call stored", async () => {
    const r = await batch.run({ entity: "tessa novak", statements: ["tessa novak is based in Cusco", "tessa novak meets on Monday"] });
    expect(r.ok).toBe(true);
    await r.rollback!();
    expect((await mem.recall("tessa novak"))!.facts).toHaveLength(0);
  });

  it("is LOW_REVERSIBLE like rememberFact and registered alongside it", () => {
    const tools = entityMemoryTools(mem);
    expect(tools.find((t) => t.name === "memory.rememberFacts")!.riskClass).toBe("LOW_REVERSIBLE");
    expect(tools.find((t) => t.name === "memory.rememberFact")!.description).toMatch(/memory\.rememberFacts/);
    expect(tools.find((t) => t.name === "memory.rememberFact")!.description).toMatch(/memory\.correct/);
    expect(tools.find((t) => t.name === "memory.correct")!.description).toMatch(/entity facts AND preferences/);
  });
});
