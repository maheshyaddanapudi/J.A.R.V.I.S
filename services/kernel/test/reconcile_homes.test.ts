import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { EntityMemory, parseSlot } from "../src/memory/entities.js";
import { MemoryService } from "../src/memory/memory.js";
import type { AuditLog } from "../src/core/audit.js";

// ---------------------------------------------------------------------------
// Longitude-XL gap G-03 (2026-09-11): one home per attribute. The 1000-day
// world held values in two places that disagreed — two facts on one slot, a
// fact beside a preference, a fact beside the entity's free-text attributes —
// and the agent then hedged ("conflicting records") or answered the stale one.
// The quiet-hours pass keeps the NEWER record and retires the older with
// history; agreeing duplicates and private facts are left alone.
// ---------------------------------------------------------------------------
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* skip */
}
const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const events = () => (audit as unknown as { append: { mock: { calls: [{ event: string; payload: Record<string, unknown> }][] } } }).append.mock.calls.map((c) => c[0]);

afterAll(async () => {
  await pool?.end();
});

describe("parseSlot — the attribute slot and value a statement carries", () => {
  it("handles the shapes the agent actually wrote", () => {
    expect(parseSlot("Status colour is ochre (changed from slate).", "Microscope Two")).toEqual({ slot: "colour status", value: "ochre" });
    expect(parseSlot("Its core material is basalt fiber.", "Microscope Two")).toEqual({ slot: "core material", value: "basalt fiber" });
    expect(parseSlot("lab-glass supplier two's assigned number is 3.", "lab-glass supplier two")).toEqual({ slot: "assigned number", value: "3" });
    expect(parseSlot("Umar Brandt is based in Bergen.", "Umar Brandt")).toEqual({ slot: "based in", value: "bergen" });
    expect(parseSlot("Umar Brandt's meeting is on Wednesday.", "umar brandt")).toEqual({ slot: "meeting", value: "wednesday" });
    expect(parseSlot("sensor importer north's home city is Cusco now.", "sensor importer north")).toEqual({ slot: "city home", value: "cusco" });
    expect(parseSlot("home city: cusco", "coral census north")).toEqual({ slot: "city home", value: "cusco" });
    expect(parseSlot("Builds the arc reactor", "Tony Stark")).toBeNull();
  });
});

describe.skipIf(!pool)("G-03 — reconcileHomes keeps the newer record and retires the older with history", () => {
  let mem: EntityMemory;
  let prefs: MemoryService;
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings, preferences CASCADE");
    (audit as unknown as { append: { mockClear(): void } }).append.mockClear();
    mem = new EntityMemory(pool!, audit);
    prefs = new MemoryService(pool!, audit);
  });
  const age = async (table: "memory_facts" | "preferences", where: string, days: number) =>
    pool!.query(`UPDATE ${table} SET ${table === "memory_facts" ? "created_at" : "updated_at"} = now() - interval '${days} days' WHERE ${where}`);

  it("two facts on one slot: the newer wins, the older is superseded (history kept), agreeing pairs untouched", async () => {
    await mem.rememberFact({ entityName: "microscope two", entityKind: "thing", statement: "status colour is slate", provenance: "t" });
    await age("memory_facts", "true", 30);
    await mem.rememberFact({ entityName: "microscope two", entityKind: "thing", statement: "status colour is ochre", provenance: "t" });
    await mem.rememberFact({ entityName: "microscope two", entityKind: "thing", statement: "its core material is cedar", provenance: "t" });
    await mem.rememberFact({ entityName: "microscope two", entityKind: "thing", statement: "the core material is cedar", provenance: "t" });
    const dry = await mem.reconcileHomes();
    expect(dry.applied).toBe(false);
    expect(dry.conflicts).toHaveLength(1);
    expect(dry.conflicts[0]).toMatchObject({ entity: "microscope two", slot: "colour status", kept: { home: "fact", value: "ochre" }, retired: { home: "fact", value: "slate" } });
    expect((await mem.recall("microscope two"))!.facts).toHaveLength(4); // dry-run wrote nothing
    const done = await mem.reconcileHomes({ apply: true });
    expect(done.applied).toBe(true);
    const facts = (await mem.recall("microscope two"))!.facts.map((f) => f.statement).sort();
    expect(facts).toEqual(["its core material is cedar", "status colour is ochre", "the core material is cedar"]);
    const { rows } = await pool!.query("SELECT status FROM memory_facts WHERE statement LIKE '%slate%' OR true ORDER BY created_at");
    expect(rows.some((r) => r.status === "superseded")).toBe(true);
    expect(events().filter((e) => e.event === "fact_superseded_by_reconciliation")).toHaveLength(1);
    expect((await mem.reconcileHomes({ apply: true })).conflicts).toEqual([]); // idempotent
  });

  it("fact vs preference: whichever is newer wins; the older is retired with history", async () => {
    // fact older than the preference → the fact is superseded
    await mem.rememberFact({ entityName: "tidal model two", entityKind: "thing", statement: "service day is wednesday", provenance: "t" });
    await age("memory_facts", "true", 90);
    await prefs.remember({ key: "tidal_model_two_service_day", value: "Thursday", provenance: "chat" });
    // preference older than the fact → the preference is soft-deleted
    await prefs.remember({ key: "weather_mast_two_assigned_number", value: "7", provenance: "chat" });
    await age("preferences", "key = 'weather_mast_two_assigned_number'", 60);
    await mem.rememberFact({ entityName: "weather mast two", entityKind: "thing", statement: "weather mast two's assigned number is 3", provenance: "t" });
    const r = await mem.reconcileHomes({ apply: true, prefs });
    expect(r.conflicts.map((c) => [c.entity, c.kept.home, c.kept.value, c.retired.home, c.retired.value]).sort()).toEqual([
      ["tidal model two", "preference", "thursday", "fact", "wednesday"],
      ["weather mast two", "fact", "3", "preference", "7"],
    ]);
    expect(await prefs.get("weather_mast_two_assigned_number")).toBeNull(); // retired (soft-deleted, row kept)
    expect((await prefs.list(true)).some((p) => p.key === "weather_mast_two_assigned_number" && p.status === "deleted")).toBe(true);
    expect((await prefs.get("tidal_model_two_service_day"))!.value).toBe("Thursday");
    expect((await mem.recall("tidal model two"))!.facts).toHaveLength(0); // the stale fact is history now
    expect(events().map((e) => e.event)).toEqual(expect.arrayContaining(["preference_superseded_by_reconciliation", "fact_superseded_by_reconciliation"]));
  });

  it("entity attributes vs a fact: the fact wins and the stale clause is removed (before/after audited)", async () => {
    await mem.rememberEntity({ kind: "person", name: "Umar Brandt", attributes: "Based in Osaka; likes tea", provenance: "t" });
    await mem.rememberFact({ entityName: "Umar Brandt", statement: "Umar Brandt is based in Bergen.", provenance: "t" });
    const r = await mem.reconcileHomes({ apply: true });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ entity: "Umar Brandt", slot: "based in", kept: { home: "fact", value: "bergen" }, retired: { home: "attributes", value: "osaka" } });
    const e = (await mem.recall("Umar Brandt"))!.entity;
    expect(e.attributes).toBe("likes tea");
    const ev = events().find((x) => x.event === "entity_attributes_reconciled");
    expect(ev?.payload).toMatchObject({ before: "Based in Osaka; likes tea", after: "likes tea", removedClause: "Based in Osaka" });
  });

  it("private facts are never touched; agreeing homes are not conflicts", async () => {
    await mem.rememberFact({ entityName: "vault", entityKind: "thing", statement: "status colour is teal", provenance: "t", sensitivity: "private" });
    await mem.rememberFact({ entityName: "vault", entityKind: "thing", statement: "status colour is ochre", provenance: "t", sensitivity: "private" });
    await prefs.remember({ key: "coral_census_two_assigned_number", value: "24", provenance: "chat" });
    await mem.rememberFact({ entityName: "coral census two", entityKind: "thing", statement: "assigned number is 24", provenance: "t" });
    const r = await mem.reconcileHomes({ apply: true, prefs });
    expect(r.conflicts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Longitude-XL gap G-07 (2026-09-11): relations had no supersession — a new
// maintainer or location simply sat beside the old one and the agent refused
// or answered "not found — maintained by X, not Y". Exclusive relations now
// replace the previous edge WITH history; additive keeps both; non-exclusive
// verbs accumulate as before; a world written before the rule can be
// reconciled (newest wins), except anchors touched by a twin merge.
// ---------------------------------------------------------------------------
describe.skipIf(!pool)("G-07 — exclusive relations supersede with history", () => {
  let mem: EntityMemory;
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_relation_history, memory_episodes, memory_embeddings, preferences CASCADE");
    (audit as unknown as { append: { mockClear(): void } }).append.mockClear();
    mem = new EntityMemory(pool!, audit);
  });

  it("a thing is in ONE place: a new located_in replaces the old edge, which moves to history (audited)", async () => {
    await mem.relate({ fromName: "field pump", toName: "boat house", relation: "located_in", provenance: "t", kind: "place" });
    const r = await mem.relate({ fromName: "field pump", toName: "cold store", relation: "is located at", provenance: "t", kind: "place" });
    expect(r.replaced).toEqual([{ fromName: "field pump", relation: "located_in", toName: "boat house" }]);
    const out = (await mem.recall("field pump"))!.relationsOut.map((x) => x.toName);
    expect(out).toEqual(["cold store"]);
    const hist = await pool!.query<{ relation: string; reason: string }>("SELECT relation, reason FROM memory_relation_history");
    expect(hist.rows).toHaveLength(1);
    expect(hist.rows[0]!.reason).toMatch(/exclusive relation 'located_in'/);
    expect(events().some((e) => e.event === "relation_superseded")).toBe(true);
  });

  it("a device has ONE maintainer of record; other devices' maintainers are untouched; additive keeps both; supplies accumulates", async () => {
    await mem.relate({ fromName: "arjun petrov", toName: "air scrubber", relation: "maintains", provenance: "t", kind: "person" });
    await mem.relate({ fromName: "arjun petrov", toName: "air scrubber two", relation: "maintains", provenance: "t", kind: "person" });
    await mem.relate({ fromName: "esme carvalho", toName: "air scrubber", relation: "maintains", provenance: "t", kind: "person" });
    expect((await mem.recall("air scrubber"))!.relationsIn.map((x) => x.fromName)).toEqual(["esme carvalho"]);
    expect((await mem.recall("air scrubber two"))!.relationsIn.map((x) => x.fromName)).toEqual(["arjun petrov"]);
    await mem.relate({ fromName: "lena iyer", toName: "air scrubber", relation: "maintains", provenance: "t", kind: "person", additive: true });
    expect((await mem.recall("air scrubber"))!.relationsIn.map((x) => x.fromName).sort()).toEqual(["esme carvalho", "lena iyer"]);
    await mem.relate({ fromName: "alloy supplier", toName: "air scrubber", relation: "supplies", provenance: "t", kind: "org" });
    await mem.relate({ fromName: "optics vendor", toName: "air scrubber", relation: "supplies", provenance: "t", kind: "org" });
    expect((await mem.recall("air scrubber"))!.relationsIn.filter((x) => x.relation === "supplies")).toHaveLength(2);
  });

  it("reconcileRelations: the newest edge wins for a pre-rule world; twin-touched anchors are skipped", async () => {
    // two located_in for one thing, written before the rule (insert directly, 10 days apart)
    await mem.relate({ fromName: "seed bank", toName: "storage unit", relation: "located_in", provenance: "t", kind: "place", additive: true });
    await pool!.query("UPDATE memory_relations SET created_at = now() - interval '10 days'");
    await mem.relate({ fromName: "seed bank", toName: "greenhouse", relation: "located_in", provenance: "t", kind: "place", additive: true });
    // a twin-touched anchor: carries a foreign alias
    await mem.relate({ fromName: "kiln north", toName: "rooftop garden north", relation: "located_in", provenance: "t", kind: "place", additive: true });
    await mem.relate({ fromName: "kiln north", toName: "observatory dome", relation: "located_in", provenance: "t", kind: "place", additive: true });
    await pool!.query("UPDATE memory_entities SET aliases = ARRAY['kiln'] WHERE lower(name) = 'kiln north'");
    const dry = await mem.reconcileRelations();
    expect(dry.applied).toBe(false);
    expect(dry.resolved).toEqual([{ relation: "located_in", anchor: "seed bank", kept: "greenhouse", retired: ["storage unit"] }]);
    expect(dry.skipped.map((s) => s.anchor)).toEqual(["kiln north"]);
    expect((await mem.recall("seed bank"))!.relationsOut).toHaveLength(2); // dry-run wrote nothing
    await mem.reconcileRelations({ apply: true });
    expect((await mem.recall("seed bank"))!.relationsOut.map((x) => x.toName)).toEqual(["greenhouse"]);
    expect((await mem.recall("kiln north"))!.relationsOut).toHaveLength(2); // skipped, untouched
    expect((await pool!.query("SELECT count(*) FROM memory_relation_history")).rows[0]!.count).toBe("1");
    expect((await mem.reconcileRelations({ apply: true })).resolved).toEqual([]); // idempotent
  });
});
