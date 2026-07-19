import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
});
