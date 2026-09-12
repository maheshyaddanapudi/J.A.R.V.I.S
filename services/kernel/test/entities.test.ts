import { describe, expect, it, afterAll, beforeAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EntityMemory } from "../src/memory/entities.js";
import type { MemoryJudge } from "../src/memory/judge.js";
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
  join(tmpdir(), `jarvis-ent-test-${randomBytes(6).toString("hex")}.json`),
  randomBytes(32),
).catch(() => undefined);

describe.skipIf(!pool)("EntityMemory (semantic knowledge store)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations CASCADE");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("remembers an entity, a fact, and a relation; recall returns them all", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "person", name: "Tony Stark", attributes: "genius, billionaire", provenance: "test" });
    await mem.rememberFact({ entityName: "Tony Stark", statement: "Builds the arc reactor", provenance: "test" });
    await mem.relate({ fromName: "Tony Stark", toName: "Iron Man Suit", relation: "builds", provenance: "test", kind: "project" });

    const r = await mem.recall("tony stark"); // case-insensitive
    expect(r).not.toBeNull();
    expect(r!.entity.kind).toBe("person");
    expect(r!.entity.attributes).toBe("genius, billionaire"); // decrypted
    expect(r!.facts.map((f) => f.statement)).toContain("Builds the arc reactor");
    expect(r!.relationsOut[0]).toMatchObject({ relation: "builds", toName: "Iron Man Suit" });

    // the reverse relation is visible from the other entity
    const suit = await mem.recall("Iron Man Suit");
    expect(suit!.relationsIn[0]).toMatchObject({ relation: "builds", fromName: "Tony Stark" });
  });

  it("encrypts fact statements at rest (DB holds ciphertext, 0 plaintext)", async () => {
    if (!vault) return;
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Pepper", entityKind: "person", statement: "Runs Stark Industries", provenance: "test" });
    const raw = await pool!.query("SELECT statement FROM memory_facts");
    expect(raw.rows[0].statement).toMatch(/^v1\.gcm\./); // ciphertext at rest
    const plain = await pool!.query("SELECT count(*) FROM memory_facts WHERE statement LIKE '%Runs Stark%'");
    expect(Number(plain.rows[0].count)).toBe(0); // no plaintext leaked
  });

  it("refuses a secret-shaped fact (R-MEM-06)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await expect(
      mem.rememberFact({ entityName: "x", statement: "api key sk-ABCDEFGH12345678ZZZZ", provenance: "test" }),
    ).rejects.toThrow(/secret/i);
  });

  it("re-remembering supersedes the old entity (one active per name+kind)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "project", name: "Reactor", attributes: "v1", provenance: "test" });
    await mem.rememberEntity({ kind: "project", name: "Reactor", attributes: "v2 palladium-free", provenance: "test" });
    const r = await mem.recall("Reactor");
    expect(r!.entity.attributes).toBe("v2 palladium-free");
    const active = await pool!.query(
      "SELECT count(*) FROM memory_entities WHERE lower(name)='reactor' AND status NOT IN ('deleted','superseded')",
    );
    expect(Number(active.rows[0].count)).toBe(1);
    // history is kept (superseded row still present)
    const all = await pool!.query("SELECT count(*) FROM memory_entities WHERE lower(name)='reactor'");
    expect(Number(all.rows[0].count)).toBe(2);
  });

  it("re-mentioning an entity MIGRATES its facts forward — knowledge is not lost (fragmentation fix)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    const v1 = await mem.rememberEntity({ kind: "thing", name: "ArcCore", attributes: "power core", provenance: "test" });
    await mem.rememberFact({ entityName: "ArcCore", statement: "uses a palladium core", provenance: "test" });
    // a later, separate mention supersedes the entity row...
    await mem.rememberEntity({ kind: "thing", name: "ArcCore", attributes: "power core, upgraded", provenance: "test" });
    await mem.rememberFact({ entityName: "ArcCore", statement: "outputs three gigajoules", provenance: "test" });
    // ...but recall of the CURRENT entity must still see BOTH facts (nothing stranded)
    const r = await mem.recall("ArcCore");
    const statements = r!.facts.map((f) => f.statement);
    expect(statements).toContain("uses a palladium core");
    expect(statements).toContain("outputs three gigajoules");
    // the earlier fact was re-pointed to the live entity, not left on the superseded row
    const stranded = await pool!.query(
      "SELECT count(*) FROM memory_facts f JOIN memory_entities e ON e.id=f.entity_id WHERE e.status='superseded' AND f.status NOT IN ('deleted','superseded') AND e.name='ArcCore'",
    );
    expect(Number(stranded.rows[0].count)).toBe(0);
  });

  it("supersede links the old entity FORWARD to its replacement (superseded_by)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    const v1 = await mem.rememberEntity({ kind: "project", name: "Suit", attributes: "Mark 1", provenance: "test" });
    const v2 = await mem.rememberEntity({ kind: "project", name: "Suit", attributes: "Mark 42", provenance: "test" });
    const { rows } = await pool!.query(
      "SELECT superseded_by FROM memory_entities WHERE id = $1", [v1.id],
    );
    expect(rows[0].superseded_by).toBe(v2.id); // the history chain is walkable, not dangling
  });

  it("correctFact supersedes a matching prior fact (with history) and links it forward", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Happy", entityKind: "person", statement: "head of security", provenance: "test" });
    const { fact, supersededCount } = await mem.correctFact({
      entityName: "Happy", newStatement: "Chief of Security", replaces: "head of security", provenance: "test",
    });
    expect(supersededCount).toBe(1);
    // recall shows ONLY the corrected fact (stale one is superseded, not lingering)
    const r = await mem.recall("Happy");
    const statements = r!.facts.map((f) => f.statement);
    expect(statements).toContain("Chief of Security");
    expect(statements).not.toContain("head of security");
    // the old fact is retained as history and points forward to the new one
    const { rows } = await pool!.query(
      "SELECT status, superseded_by FROM memory_facts WHERE entity_id = (SELECT entity_id FROM memory_facts WHERE id=$1) AND status='superseded'",
      [fact.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].superseded_by).toBe(fact.id);
  });

  it("correctFact targets an exact factId (read-then-write, no guessing)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Vision", entityKind: "person", statement: "powered by the Mind Stone", provenance: "test" });
    const keep = await mem.rememberFact({ entityName: "Vision", statement: "can phase through walls", provenance: "test" });
    const target = (await mem.recall("Vision"))!.facts.find((f) => f.statement.includes("Mind Stone"))!;
    const { supersededCount, fact } = await mem.correctFact({
      entityName: "Vision", newStatement: "powered by the solar gem", factId: target.id, provenance: "test",
    });
    expect(supersededCount).toBe(1);
    const after = (await mem.recall("Vision"))!.facts.map((f) => f.statement);
    expect(after).toContain("powered by the solar gem");
    expect(after).toContain("can phase through walls");    // untargeted fact untouched
    expect(after).not.toContain("powered by the Mind Stone");
    // superseded row points forward at the replacement
    const { rows } = await pool!.query("SELECT superseded_by FROM memory_facts WHERE id=$1", [target.id]);
    expect(rows[0].superseded_by).toBe(fact.id);
    expect(keep.id).not.toBe(target.id);
  });

  it("correctFact REFUSES a stale/foreign factId instead of guessing", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Wanda", entityKind: "person", statement: "lives in Westview", provenance: "test" });
    await expect(mem.correctFact({
      entityName: "Wanda", newStatement: "lives in Malibu",
      factId: "00000000-0000-0000-0000-000000000000", provenance: "test",
    })).rejects.toThrow(/no active fact/);
    // nothing changed
    expect((await mem.recall("Wanda"))!.facts.map((f) => f.statement)).toEqual(["lives in Westview"]);
  });

  it("forgetFact soft-deletes ONE fact, leaving the entity and other facts intact", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Thor", entityKind: "person", statement: "wields Mjolnir", provenance: "test" });
    await mem.rememberFact({ entityName: "Thor", statement: "is from Asgard", provenance: "test" });
    const gone = (await mem.recall("Thor"))!.facts.find((f) => f.statement.includes("Mjolnir"))!;
    expect(await mem.forgetFact(gone.id)).toBe(true);
    expect(await mem.forgetFact(gone.id)).toBe(false); // already inactive → honest false
    const after = (await mem.recall("Thor"))!;
    expect(after.facts.map((f) => f.statement)).toEqual(["is from Asgard"]);
  });

  it("correctFact matches by WORD-OVERLAP when the wording differs (robust supersede)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Me", entityKind: "person", statement: "runs at 6am every day", provenance: "test" });
    // 'replaces' is worded differently ("6am run") but overlaps → still supersedes
    const { supersededCount } = await mem.correctFact({
      entityName: "Me", newStatement: "runs at 5:30am", replaces: "6am run", provenance: "test",
    });
    expect(supersededCount).toBe(1);
    const r = await mem.recall("Me");
    expect(r!.facts.map((f) => f.statement)).toEqual(["runs at 5:30am"]);
  });

  it("correctFact with no matching 'replaces' still records the new fact (reported)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Loki", entityKind: "person", statement: "is in Asgard", provenance: "test" });
    const { supersededCount } = await mem.correctFact({
      entityName: "Loki", newStatement: "is on Earth", replaces: "no such prior statement", provenance: "test",
    });
    expect(supersededCount).toBe(0);
    const r = await mem.recall("Loki");
    expect(r!.facts.map((f) => f.statement)).toContain("is on Earth");
  });

  it("forget excludes an entity from recall immediately", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "person", name: "Obadiah", provenance: "test" });
    expect(await mem.recall("Obadiah")).not.toBeNull();
    expect(await mem.forgetEntity("Obadiah")).toBe(true);
    expect(await mem.recall("Obadiah")).toBeNull();
  });

  it("recentForContext returns only non-sensitive entities + facts (never private/secret)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "person", name: "Pepper", provenance: "test", sensitivity: "personal" });
    await mem.rememberFact({ entityName: "Pepper", statement: "leads Stark Industries", provenance: "test", sensitivity: "personal" });
    await mem.rememberFact({ entityName: "Pepper", statement: "home address is private", provenance: "test", sensitivity: "private" });
    await mem.rememberEntity({ kind: "person", name: "SecretAsset", provenance: "test", sensitivity: "secret" });

    const ctx = await mem.recentForContext(10);
    const names = ctx.map((e) => e.name);
    expect(names).toContain("Pepper");
    expect(names).not.toContain("SecretAsset"); // secret entity excluded
    const pepper = ctx.find((e) => e.name === "Pepper")!;
    expect(pepper.facts).toContain("leads Stark Industries");
    expect(pepper.facts).not.toContain("home address is private"); // private fact excluded
  });

  it("consolidate() merges near-duplicate facts (quiet-hours pass, D-0063), keeps distinct ones", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Luis", entityKind: "person", statement: "programs my strength sessions", provenance: "test" });
    await mem.rememberFact({ entityName: "Luis", statement: "Luis programs my strength sessions on Tuesdays and Fridays", provenance: "test" });
    await mem.rememberFact({ entityName: "Luis", statement: "allergic to peanuts", provenance: "test" });
    const r = await mem.consolidate();
    expect(r.duplicatesMerged).toBe(1); // the restatement merged into the fuller fact
    const after = (await mem.recall("Luis"))!.facts.map((f) => f.statement);
    expect(after).toContain("Luis programs my strength sessions on Tuesdays and Fridays");
    expect(after).toContain("allergic to peanuts");           // distinct fact untouched
    expect(after).not.toContain("programs my strength sessions"); // older restatement gone from recall
    // merged row is HISTORY, not deleted — superseded + forward-linked
    const { rows } = await pool!.query(
      "SELECT count(*) FROM memory_facts WHERE status='superseded' AND superseded_by IS NOT NULL",
    );
    expect(Number(rows[0].count)).toBe(1);
    // idempotent: a second pass finds nothing new
    expect((await mem.consolidate()).duplicatesMerged).toBe(0);
  });

  it("consolidate() merges across MORPHOLOGY (reviews ~ reviewing) via light stemming", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberFact({ entityName: "Pepper", entityKind: "person", statement: "Pepper reviews the investor deck", provenance: "test" });
    await mem.rememberFact({ entityName: "Pepper", statement: "Pepper is reviewing the Q3 investor deck this week", provenance: "test" });
    await mem.rememberFact({ entityName: "Pepper", statement: "met Pepper at the Tokyo office", provenance: "test" });
    const r = await mem.consolidate();
    expect(r.duplicatesMerged).toBe(1);
    const after = (await mem.recall("Pepper"))!.facts.map((f) => f.statement);
    expect(after).toContain("Pepper is reviewing the Q3 investor deck this week"); // fuller, newer kept
    expect(after).toContain("met Pepper at the Tokyo office");                      // distinct kept
    expect(after).not.toContain("Pepper reviews the investor deck");                // restatement merged
  });

  it("consolidate() PROPOSES stale entities for review — never auto-forgets", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "thing", name: "Old Gadget", provenance: "test" });
    await pool!.query(
      "UPDATE memory_entities SET updated_at = now() - interval '120 days', last_used_at = NULL WHERE name = 'Old Gadget'",
    );
    const r = await mem.consolidate({ staleDays: 90 });
    expect(r.staleProposals).toContain("Old Gadget");
    expect(await mem.recall("Old Gadget")).not.toBeNull(); // still recallable — proposal only
  });

  it("lists entities by kind", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "person", name: "Rhodey", provenance: "test" });
    await mem.rememberEntity({ kind: "project", name: "War Machine", provenance: "test" });
    const people = await mem.listEntities("person");
    expect(people.map((e) => e.name)).toContain("Rhodey");
    expect(people.every((e) => e.kind === "person")).toBe(true);
  });

  // ---- D-0075: fast-model memory judgments (with a stub judge) ----

  it("resolves a name-variant to the SAME entity via the judge — no duplicate, alias recorded (bug 2)", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async (subject, candidates) => {
        const idx = candidates.findIndex(
          (c) => c.name.toLowerCase().includes(subject.name.toLowerCase()) || subject.name.toLowerCase().includes(c.name.toLowerCase()),
        );
        return idx >= 0 ? { sameAs: idx, reason: "same person" } : { sameAs: null, reason: "new" };
      },
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    await mem.rememberEntity({ kind: "person", name: "Pepper Potts", provenance: "test" });
    await mem.rememberFact({ entityName: "Pepper Potts", statement: "is CEO of Stark Industries", provenance: "test" });
    // a later, SHORT-name mention resolves to the same real person
    await mem.rememberEntity({ kind: "person", name: "Pepper", provenance: "test" });
    await mem.rememberFact({ entityName: "Pepper", statement: "prefers morning meetings", provenance: "test" });

    // exactly ONE active person entity — not two variant duplicates
    const active = await pool!.query<{ name: string; aliases: string[] }>(
      "SELECT name, aliases FROM memory_entities WHERE kind='person' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows.length).toBe(1);
    expect(active.rows[0]!.name).toBe("Pepper Potts");
    expect(active.rows[0]!.aliases).toContain("pepper");

    // recall by EITHER name returns the one entity with BOTH facts
    for (const q of ["Pepper", "Pepper Potts"]) {
      const r = await mem.recall(q);
      expect(r, `recall('${q}')`).not.toBeNull();
      const s = r!.facts.map((f) => f.statement);
      expect(s).toContain("is CEO of Stark Industries");
      expect(s).toContain("prefers morning meetings");
    }
  });

  it("consolidate() honors the judge's merge decision, merging facts the heuristic keeps apart (dim 5)", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async () => ({ sameAs: null, reason: "n/a" }),
      // model says the two facts restate the same thing; keep the newer (idx 1)
      mergeFacts: async (_entity, facts) => (facts.length >= 2 ? [{ keep: 1, supersede: [0] }] : []),
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    await mem.rememberEntity({ kind: "thing", name: "Suit", provenance: "test" });
    await mem.rememberFact({ entityName: "Suit", statement: "can fly at high altitude", provenance: "test" });
    await mem.rememberFact({ entityName: "Suit", statement: "reaches high altitudes in flight", provenance: "test" });
    const r = await mem.consolidate();
    expect(r.duplicatesMerged).toBe(1);
    expect(r.merged[0]).toContain("(model)");
    const rec = await mem.recall("Suit");
    expect(rec!.facts.length).toBe(1);
    expect(rec!.facts[0]!.statement).toBe("reaches high altitudes in flight");
  });

  it("G-28: a judge merge may not fold facts about DIFFERENT attributes — the slot guard keeps them (act three, day 1027)", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async () => ({ sameAs: null, reason: "n/a" }),
      // the model claims all three restate one thing — what the fast judge did to theo eriksen
      mergeFacts: async (_entity, facts) => (facts.length >= 3 ? [{ keep: 2, supersede: [0, 1] }] : []),
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    await mem.rememberEntity({ kind: "person", name: "theo eriksen", provenance: "test" });
    await mem.rememberFact({ entityName: "theo eriksen", statement: "theo eriksen meets on Tuesday", provenance: "test" });
    await mem.rememberFact({ entityName: "theo eriksen", statement: "theo eriksen is based in Lisbon", provenance: "test" });
    await mem.rememberFact({ entityName: "theo eriksen", statement: 'theo eriksen usually goes by "Theo" — same person', provenance: "test" });
    const r = await mem.consolidate();
    expect(r.duplicatesMerged).toBe(0);
    expect(r.refused.length).toBe(2);
    expect(r.refused.join(" ")).toContain("different things");
    const rec = await mem.recall("theo eriksen");
    expect(rec!.facts.length).toBe(3);
    expect(rec!.facts.map((f) => f.statement)).toEqual(
      expect.arrayContaining(["theo eriksen meets on Tuesday", "theo eriksen is based in Lisbon"]),
    );
  });

  it("G-28: a judge merge on the SAME slot still goes through — audited per fact and announced by name", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async () => ({ sameAs: null, reason: "n/a" }),
      mergeFacts: async (_entity, facts) => (facts.length >= 2 ? [{ keep: 1, supersede: [0] }] : []),
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    const changes: { kind: string; about: string; text: string }[] = [];
    mem.onMemoryChange = async (c) => { changes.push(c); };
    await mem.rememberEntity({ kind: "person", name: "umar brandt", provenance: "test" });
    await mem.rememberFact({ entityName: "umar brandt", statement: "umar brandt is based in Bergen", provenance: "test" });
    await mem.rememberFact({ entityName: "umar brandt", statement: "umar brandt is based in Bergen, Norway", provenance: "test" });
    (audit.append as unknown as ReturnType<typeof vi.fn>).mockClear();
    const r = await mem.consolidate();
    expect(r.duplicatesMerged).toBe(1);
    expect(r.refused).toEqual([]);
    const events = (audit.append as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toContain("fact_merged_by_consolidation");
    expect(changes.some((c) => c.kind === "fact-merge" && c.about === "umar brandt" && c.text.includes("Bergen"))).toBe(true);
  });

  it("G-26: a declared alias is an identity — a SHORT nickname resolves on every read path; clashes and twins are refused", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "person", name: "ravi lindholm", provenance: "test" });
    await mem.rememberFact({ entityName: "ravi lindholm", statement: "ravi lindholm meets on Tuesday", provenance: "test" });
    const r = await mem.addAlias({ entityName: "ravi lindholm", alias: "Ravi", provenance: "test" });
    expect(r.added).toBe(true);
    expect(r.aliases).toEqual(["ravi"]);
    expect((await mem.recall("ravi"))!.entity.name).toBe("ravi lindholm");
    const g = await mem.recallGraph("what is the ravi's meets on?");
    expect(g.seeds[0]).toEqual({ name: "ravi lindholm", via: "identity" });
    // idempotent
    expect((await mem.addAlias({ entityName: "ravi lindholm", alias: "ravi", provenance: "test" })).added).toBe(false);
    // an alias that already names another entity is refused — an ambiguous handle stays a question (G-12)
    await mem.rememberEntity({ kind: "person", name: "pavel bergstrom", provenance: "test" });
    await mem.rememberEntity({ kind: "person", name: "pavel hoffmann", provenance: "test" });
    await mem.addAlias({ entityName: "pavel bergstrom", alias: "pavel", provenance: "test" });
    await expect(mem.addAlias({ entityName: "pavel hoffmann", alias: "pavel", provenance: "test" })).rejects.toThrow(/already names/);
    // a qualifier twin is a different thing, never another name (G-17)
    await mem.rememberEntity({ kind: "device", name: "kiln north", provenance: "test" });
    await expect(mem.addAlias({ entityName: "kiln north", alias: "kiln", provenance: "test" })).rejects.toThrow(/qualifier/);
    // rollback path
    expect(await mem.removeAlias("ravi lindholm", "ravi")).toBe(true);
    expect(await mem.recall("ravi")).toBeNull();
  });

  it("falls back to deterministic logic when the judge is absent (offline honesty)", async () => {
    // no judge injected → the string-heuristic path still merges obvious dupes
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "thing", name: "Core", provenance: "test" });
    await mem.rememberFact({ entityName: "Core", statement: "runs on a palladium core", provenance: "test" });
    await mem.rememberFact({ entityName: "Core", statement: "the core runs on palladium", provenance: "test" });
    const r = await mem.consolidate({ overlap: 0.6 });
    expect(r.duplicatesMerged).toBe(1);
    expect(r.merged[0]).not.toContain("(model)"); // deterministic path, no model tag
  });

  it("serializes concurrent same-name writes — no duplicate active rows (advisory lock, bug 5)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await Promise.all(
      Array.from({ length: 6 }, () => mem.rememberEntity({ kind: "thing", name: "arc reactor", provenance: "test" })),
    );
    const active = await pool!.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM memory_entities WHERE lower(name)='arc reactor' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows[0]!.n).toBe(1);
  });

  it("promotes the FULLER name to canonical when the short variant arrived first (D-0075)", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async (subject, candidates) => {
        const idx = candidates.findIndex(
          (c) => c.name.toLowerCase().includes(subject.name.toLowerCase()) || subject.name.toLowerCase().includes(c.name.toLowerCase()),
        );
        return idx >= 0 ? { sameAs: idx, reason: "same person" } : { sameAs: null, reason: "new" };
      },
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    // the SHORT name is seen first...
    await mem.rememberEntity({ kind: "person", name: "Pepper", provenance: "test" });
    await mem.rememberFact({ entityName: "Pepper", statement: "is CEO of Stark Industries", provenance: "test" });
    // ...then the FULLER name arrives — canonical should PROMOTE to 'Pepper Potts'
    await mem.rememberEntity({ kind: "person", name: "Pepper Potts", provenance: "test" });

    const active = await pool!.query<{ name: string; aliases: string[] }>(
      "SELECT name, aliases FROM memory_entities WHERE kind='person' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows.length).toBe(1);
    expect(active.rows[0]!.name).toBe("Pepper Potts"); // fuller name won
    expect(active.rows[0]!.aliases).toContain("pepper"); // short name demoted to alias
    for (const q of ["Pepper", "Pepper Potts"]) {
      const r = await mem.recall(q);
      expect(r!.facts.map((f) => f.statement)).toContain("is CEO of Stark Industries");
    }
  });

  it("re-mentioning via an ALIAS does NOT rename the entity to the short variant (D-0075)", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async (subject, candidates) => {
        const idx = candidates.findIndex((c) => c.name.toLowerCase().includes(subject.name.toLowerCase()));
        return idx >= 0 ? { sameAs: idx, reason: "same" } : { sameAs: null, reason: "new" };
      },
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    await mem.rememberEntity({ kind: "person", name: "Pepper Potts", provenance: "test" });
    await mem.rememberEntity({ kind: "person", name: "Pepper", provenance: "test" }); // resolves + aliases 'pepper'
    // now re-mention by the alias 'Pepper' — must stay 'Pepper Potts', not rename
    await mem.rememberEntity({ kind: "person", name: "Pepper", provenance: "test" });
    const active = await pool!.query<{ name: string }>(
      "SELECT name FROM memory_entities WHERE kind='person' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows.length).toBe(1);
    expect(active.rows[0]!.name).toBe("Pepper Potts");
  });

  it("a partial unique index structurally forbids two active (name, kind) rows (bug 5 backstop, from migration 0010)", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "thing", name: "Reactor", provenance: "test" });
    // a raw second active insert (bypassing the lock/supersede path) must be REJECTED
    // case-insensitively ('reactor' collides with 'Reactor') — the DB-level guarantee
    // behind which the advisory lock serializes to avoid these violations entirely.
    await expect(
      pool!.query("INSERT INTO memory_entities (kind, name, status, provenance) VALUES ('thing','reactor','user_statement','test')"),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  // ---- D-0075 cross-kind resolution ----

  it("prevents a cross-kind duplicate: same name, different kind, judge says same → ONE entity", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async (subject, candidates) => {
        const idx = candidates.findIndex((c) => c.name.toLowerCase() === subject.name.toLowerCase());
        return idx >= 0 ? { sameAs: idx, reason: "same thing, inconsistent kind" } : { sameAs: null, reason: "new" };
      },
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    await mem.rememberEntity({ kind: "thing", name: "arc reactor", provenance: "test" });
    await mem.rememberFact({ entityName: "arc reactor", statement: "runs on palladium", provenance: "test" });
    // a later session labels the SAME thing as a 'project'
    await mem.rememberEntity({ kind: "project", name: "arc reactor", provenance: "test" });
    const active = await pool!.query<{ kind: string }>(
      "SELECT kind FROM memory_entities WHERE lower(name)='arc reactor' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows.length).toBe(1); // NOT two (thing + project)
    expect(active.rows[0]!.kind).toBe("thing"); // merged into the existing entity's kind
    expect((await mem.recall("arc reactor"))!.facts.map((f) => f.statement)).toContain("runs on palladium");
  });

  it("keeps genuinely-different same-name entities distinct when the judge says NOT same", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async () => ({ sameAs: null, reason: "planet vs element — different" }),
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    await mem.rememberEntity({ kind: "place", name: "Mercury", provenance: "test" }); // the planet
    await mem.rememberEntity({ kind: "thing", name: "Mercury", provenance: "test" }); // the element
    const active = await pool!.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM memory_entities WHERE lower(name)='mercury' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows[0]!.n).toBe(2); // both kept — genuinely different real-world things
  });

  it("consolidate() HEALS a pre-existing cross-kind duplicate via the judge", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async () => ({ sameAs: null, reason: "n/a" }),
      mergeFacts: async () => [],
      mergeEntities: async (_name, entities) => (entities.length >= 2 ? [{ keep: 0, merge: entities.slice(1).map((e) => e.idx) }] : []),
      extractTopics: async () => [],
    };
    const mem = new EntityMemory(pool!, audit, vault, undefined, judge);
    // seed two same-name entities of DIFFERENT kinds (a pre-existing duplicate), a fact each
    await pool!.query(
      "INSERT INTO memory_entities (kind, name, status, provenance) VALUES ('thing','Reactor','user_statement','seed'),('project','Reactor','user_statement','seed')",
    );
    const ids = await pool!.query<{ id: string; kind: string }>(
      "SELECT id, kind FROM memory_entities WHERE lower(name)='reactor' AND status NOT IN ('deleted','superseded') ORDER BY kind",
    );
    for (const row of ids.rows) {
      await pool!.query("INSERT INTO memory_facts (entity_id, statement, status, provenance) VALUES ($1,$2,'user_statement','seed')", [row.id, `fact for ${row.kind}`]);
    }
    const r = await mem.consolidate();
    expect(r.entitiesMerged).toBe(1);
    expect(r.entityMerges[0]).toContain("(model)");
    const active = await pool!.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM memory_entities WHERE lower(name)='reactor' AND status NOT IN ('deleted','superseded')",
    );
    expect(active.rows[0]!.n).toBe(1); // merged to one
    expect((await mem.recall("Reactor"))!.facts.length).toBe(2); // both facts on the survivor
  });
});

// ---------------------------------------------------------------------------
// Longitude-XL gap G-17 (2026-09-11): the resolver had folded 29 separately-
// taught QUALIFIER TWINS ('coral census' → 'Coral Census Two', 'kiln' → 'kiln
// north') into their siblings as aliases; every later exact lookup answered
// with the sibling's values. Twins are different things by rule; merges are
// audited + announced; pre-fix merges can be split back with history.
// ---------------------------------------------------------------------------
import { qualifierTwin } from "../src/memory/entities.js";

describe.skipIf(!pool)("G-17 — qualifier twins are different things", () => {
  let p: pg.Pool;
  beforeAll(() => { p = new pg.Pool({ connectionString: process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test" }); });
  afterAll(async () => { await p.end(); });
  const calls = () => (audit as unknown as { append: { mock: { calls: [{ event: string; payload: Record<string, unknown> }][] } } }).append.mock.calls.map((c) => c[0]);
  beforeEach(async () => {
    await p.query("TRUNCATE memory_entities, memory_facts, memory_relations CASCADE");
    (audit as unknown as { append: { mockClear(): void } }).append.mockClear();
  });

  it("qualifierTwin: same base + different qualifier = twins; variants and fuller names are not", () => {
    expect(qualifierTwin("coral census", "coral census two")).toBe(true);
    expect(qualifierTwin("the kiln", "kiln north")).toBe(true);
    expect(qualifierTwin("sensor importer two", "sensor importer north")).toBe(true);
    expect(qualifierTwin("3d printer", "3D Printer North")).toBe(true);
    expect(qualifierTwin("kiln", "the kiln")).toBe(false); // article variant — same thing
    expect(qualifierTwin("Pepper", "Pepper Potts")).toBe(false); // fuller name
    expect(qualifierTwin("Mark 42", "Mark 42 suit")).toBe(false);
    expect(qualifierTwin("seed bank", "seed vault")).toBe(false); // different head noun — the template's job
    expect(qualifierTwin("coral census two", "Coral Census Two")).toBe(false);
  });

  it("a judge that would say SAME never sees the twin as a candidate; both entities stay, no alias", async () => {
    const seen: string[][] = [];
    const judge: MemoryJudge = {
      resolveEntity: async (_s, candidates) => {
        seen.push(candidates.map((c) => c.name));
        return candidates.length ? { sameAs: 0, reason: "short vs full name" } : { sameAs: null, reason: "none" };
      },
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
      assessAgendaFreshness: async () => null,
    } as unknown as MemoryJudge;
    const mem = new EntityMemory(p, audit, vault, undefined, judge);
    await mem.rememberFact({ entityName: "coral census", entityKind: "thing", statement: "the coral census's status colour is teal", provenance: "t" });
    await mem.rememberFact({ entityName: "coral census two", entityKind: "thing", statement: "the coral census two's status colour is ochre", provenance: "t" });
    const active = await p.query<{ name: string; aliases: string[] }>(
      "SELECT name, aliases FROM memory_entities WHERE status NOT IN ('deleted','superseded') ORDER BY name",
    );
    expect(active.rows.map((r) => r.name)).toEqual(["coral census", "coral census two"]);
    expect(active.rows.every((r) => (r.aliases ?? []).length === 0)).toBe(true);
    expect(seen.flat()).not.toContain("coral census"); // the twin was filtered before the judge
    expect((await mem.recall("coral census"))!.facts.map((f) => f.statement)).toEqual(["the coral census's status colour is teal"]);
    expect((await mem.recall("coral census two"))!.facts.map((f) => f.statement)).toEqual(["the coral census two's status colour is ochre"]);
  });

  it("a genuine variant merge (Pepper → Pepper Potts) still happens — and is now audited and announced", async () => {
    const judge: MemoryJudge = {
      resolveEntity: async (s, candidates) => {
        const i = candidates.findIndex((c) => c.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(c.name.toLowerCase()));
        return i >= 0 ? { sameAs: i, reason: "short vs full name" } : { sameAs: null, reason: "new" };
      },
      mergeFacts: async () => [],
      mergeEntities: async () => [],
      extractTopics: async () => [],
      assessAgendaFreshness: async () => null,
    } as unknown as MemoryJudge;
    const mem = new EntityMemory(p, audit, vault, undefined, judge);
    const announced: { kind: string; text: string }[] = [];
    mem.onMemoryChange = async (c) => { announced.push(c); };
    await mem.rememberEntity({ kind: "person", name: "Pepper", provenance: "t" });
    await mem.rememberEntity({ kind: "person", name: "Pepper Potts", provenance: "t" });
    await new Promise((r) => setTimeout(r, 10));
    const merged = calls().find((c) => c.event === "entity_alias_merged");
    expect(merged?.payload).toMatchObject({ mention: "Pepper Potts", into: "Pepper", canonical: "Pepper Potts" });
    expect(announced.map((a) => a.kind)).toEqual(["merge"]);
    expect(announced[0]!.text).toMatch(/another name for "Pepper"/);
  });

  it("a twin alias left behind by a pre-fix merge no longer resolves the short name to its sibling", async () => {
    const mem = new EntityMemory(p, audit, vault);
    await mem.rememberFact({ entityName: "Coral Census Two", entityKind: "thing", statement: "the coral census two's status colour is ochre", provenance: "t" });
    await p.query(`UPDATE memory_entities SET aliases = ARRAY['coral census'] WHERE lower(name) = 'coral census two'`);
    expect(await mem.recall("coral census")).toBeNull(); // honest — not the twin's values
    expect((await mem.recall("Coral Census Two"))!.facts).toHaveLength(1);
    // and a fresh write to the short name gets its own entity, not the sibling
    await mem.rememberFact({ entityName: "coral census", entityKind: "thing", statement: "the coral census's status colour is teal", provenance: "t" });
    const active = await p.query<{ name: string }>("SELECT name FROM memory_entities WHERE status NOT IN ('deleted','superseded') ORDER BY name");
    expect(active.rows.map((r) => r.name)).toEqual(["Coral Census Two", "coral census"]);
    // identity seeding ranks the exact entity first; the sibling's twin alias never counts as its name
    const g = await mem.recallGraph("what is the coral census's status colour?");
    expect(g.seeds[0]).toEqual({ name: "coral census", via: "identity" });
    expect((await mem.recall("coral census"))!.facts.map((f) => f.statement)).toEqual(["the coral census's status colour is teal"]);
  });

  it("splitTwinAliases: dry-run reports, apply gives the folded twin its own entity with its facts + relations, audited + announced", async () => {
    const mem = new EntityMemory(p, audit, vault);
    const announced: { kind: string; text: string }[] = [];
    mem.onMemoryChange = async (c) => { announced.push(c); };
    // the day-1000 shape: one canonical carrying a twin's facts, the twin's own row superseded
    await mem.rememberFact({ entityName: "Coral Census Two", entityKind: "thing", statement: "the coral census two's status colour is ochre", provenance: "t" });
    await mem.rememberFact({ entityName: "Coral Census Two", entityKind: "thing", statement: "the coral census's status colour is teal", provenance: "t" });
    await mem.rememberFact({ entityName: "Coral Census Two", entityKind: "thing", statement: "the coral census's home city is bergen", provenance: "t" });
    await mem.relate({ fromName: "Coral Census Two", toName: "boat shed", relation: "is located at", provenance: "t", kind: "place" });
    await p.query(`UPDATE memory_entities SET aliases = ARRAY['coral census'] WHERE lower(name) = 'coral census two'`);
    await p.query(
      `INSERT INTO memory_entities (kind, name, attributes, aliases, status, provenance, confidence, sensitivity)
       VALUES ('project', 'coral census', '', '{}', 'superseded', 't', 1.0, 'personal')`,
    );
    // 'kiln north' carrying the article-variant pair 'kiln' + 'the kiln' → ONE split
    await mem.rememberFact({ entityName: "kiln north", entityKind: "thing", statement: "kiln north's status colour is slate", provenance: "t" });
    await mem.rememberFact({ entityName: "kiln north", entityKind: "thing", statement: "the kiln is wrapped up as of today", provenance: "t" });
    await p.query(`UPDATE memory_entities SET aliases = ARRAY['kiln','the kiln'] WHERE lower(name) = 'kiln north'`);
    // a twin whose facts carry no subject ("Status colour is ochre") and whose
    // relations were recorded under the merged name cannot be attributed —
    // reported as unsplit, never guessed
    await mem.rememberFact({ entityName: "Microscope Two", entityKind: "thing", statement: "Status colour is ochre", provenance: "t" });
    await p.query(`UPDATE memory_entities SET aliases = ARRAY['microscope'] WHERE lower(name) = 'microscope two'`);
    const hints = [{ from: "coral census", to: "boat shed", relation: "is located at" }];

    const dry = await mem.splitTwinAliases({ relationHints: hints });
    expect(dry.applied).toBe(false);
    expect(dry.unsplit.map((u) => [u.canonical, u.alias, u.factsOnCanonical])).toEqual([["Microscope Two", "microscope", 1]]);
    expect(dry.splits.map((s) => [s.canonical, s.alias, s.facts.length, s.relations])).toEqual([
      ["Coral Census Two", "coral census", 2, 1],
      ["kiln north", "kiln", 1, 0],
    ]);
    expect((await mem.recall("microscope"))).toBeNull(); // the unsplit twin alias no longer resolves to its sibling either
    expect(await mem.recall("coral census")).toBeNull(); // dry-run wrote nothing

    const done = await mem.splitTwinAliases({ apply: true, relationHints: hints });
    expect(done.applied).toBe(true);
    const cc = await mem.recall("coral census");
    expect(cc!.entity.kind).toBe("project"); // recovered from its own superseded row
    expect(cc!.facts.map((f) => f.statement).sort()).toEqual(["the coral census's home city is bergen", "the coral census's status colour is teal"]);
    expect(cc!.relationsOut.map((r) => [r.relation, r.toName])).toEqual([["is located at", "boat shed"]]);
    const two = await mem.recall("Coral Census Two");
    expect(two!.facts.map((f) => f.statement)).toEqual(["the coral census two's status colour is ochre"]);
    expect(two!.relationsOut).toHaveLength(0);
    const kiln = await mem.recall("kiln");
    expect(kiln!.facts.map((f) => f.statement)).toEqual(["the kiln is wrapped up as of today"]);
    expect((await mem.recall("the kiln"))!.entity.name).toBe("kiln"); // the article variant rides along as an alias
    const aliases = await p.query<{ name: string; aliases: string[] }>("SELECT name, aliases FROM memory_entities WHERE status NOT IN ('deleted','superseded') ORDER BY name");
    expect(Object.fromEntries(aliases.rows.map((r) => [r.name, r.aliases ?? []]))).toMatchObject({ "Coral Census Two": [], "kiln north": [], kiln: ["the kiln"] });
    expect(calls().filter((c) => c.event === "entity_alias_split")).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 10));
    expect(announced.map((a) => a.kind)).toEqual(["split", "split"]);
    // idempotent: nothing left to split
    expect((await mem.splitTwinAliases({ relationHints: hints })).splits).toEqual([]);
  });
});
