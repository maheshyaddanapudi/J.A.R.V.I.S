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

  it("forget excludes an entity from recall immediately", async () => {
    const mem = new EntityMemory(pool!, audit, vault);
    await mem.rememberEntity({ kind: "person", name: "Obadiah", provenance: "test" });
    expect(await mem.recall("Obadiah")).not.toBeNull();
    expect(await mem.forgetEntity("Obadiah")).toBe(true);
    expect(await mem.recall("Obadiah")).toBeNull();
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
