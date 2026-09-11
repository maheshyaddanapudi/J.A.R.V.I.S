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
