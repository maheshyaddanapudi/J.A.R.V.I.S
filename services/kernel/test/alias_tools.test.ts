import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { EntityMemory } from "../src/memory/entities.js";
import { aliasInDisguise, entityMemoryTools } from "../src/memory/entityTools.js";
import type { AuditLog } from "../src/core/audit.js";

/**
 * G-26 (2026-09-12, Longitude-XL act three): "X usually goes by Y" is another
 * NAME for X. Before this, the agent stored it as a fact, identity matching
 * never read facts, and every nickname question opened with "not found"
 * (0/2 at the day-1010 and day-1020 batteries). The write path is
 * `memory.alias` (or `aliases` on `memory.rememberEntity`); a naming statement
 * offered as a fact is refused with the exact alias call handed back.
 */

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

describe("aliasInDisguise — naming statements, nothing else", () => {
  it("recognises the nickname shapes the user actually says", () => {
    expect(aliasInDisguise("theo eriksen", 'theo eriksen usually goes by "Theo" — same person, just a nickname')).toEqual({ alias: "Theo" });
    expect(aliasInDisguise("ravi lindholm", "usually just goes by ravi — same person")).toEqual({ alias: "ravi" });
    expect(aliasInDisguise("pepper potts", "Pepper Potts is also known as Pepper")).toEqual({ alias: "Pepper" });
    expect(aliasInDisguise("the workshop annex", "the workshop annex is called the shed, which is where the kiln is")).toEqual({ alias: "the shed" });
  });
  it("leaves real facts alone", () => {
    expect(aliasInDisguise("kiln", "the kiln's status colour is teal")).toBeNull();
    expect(aliasInDisguise("ravi lindholm", "ravi lindholm meets on Tuesday")).toBeNull();
    expect(aliasInDisguise("umar brandt", "umar brandt is based in Bergen")).toBeNull();
    // the alias must differ from the entity's own name
    expect(aliasInDisguise("ravi", "goes by ravi")).toBeNull();
  });
});

describe.skipIf(!pool)("G-26 — memory.alias: nicknames are identities", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, memory_embeddings CASCADE");
  });

  it("rememberFact refuses a naming statement with the alias call; memory.alias records it; lookup then finds the entity by the nickname", async () => {
    const mem = new EntityMemory(pool!, audit);
    const tools = entityMemoryTools(mem);
    const tool = (n: string) => tools.find((t) => t.name === n)!;
    expect(tool("memory.alias")).toBeDefined();

    await tool("memory.rememberEntity").run({ kind: "person", name: "ravi lindholm" });
    await tool("memory.rememberFact").run({ entity: "ravi lindholm", statement: "ravi lindholm meets on Tuesday" });

    const refused = await tool("memory.rememberFact").run({ entity: "ravi lindholm", statement: "usually just goes by ravi — same person" });
    expect(refused.ok).toBe(false);
    expect(refused.summary).toContain("memory.alias");
    expect(refused.data).toMatchObject({ route: "alias", alias: "ravi", write: "memory.alias" });
    // nothing was written as a fact
    expect((await mem.recall("ravi lindholm"))!.facts.length).toBe(1);

    const added = await tool("memory.alias").run({ entity: "ravi lindholm", alias: "ravi" });
    expect(added.ok).toBe(true);
    expect(added.summary).toContain("read back");
    expect(added.data).toMatchObject({ entity: "ravi lindholm", alias: "ravi", added: true });

    // the batch write refuses the same shape per item
    const batch = await tool("memory.rememberFacts").run({ entity: "ravi lindholm", statements: ["ravi lindholm's preferred material is graphene", "ravi lindholm is also known as rav"] });
    expect(batch.ok).toBe(false);
    expect((batch.data as { stored: number; failed: number }).stored).toBe(1);
    expect(batch.detail).toContain("memory.alias");

    // the one-call answer path resolves the SHORT handle as the entity named in the question
    const look = await tool("memory.lookup").run({ queries: ["What is the ravi's meets on?"] });
    expect(look.ok).toBe(true);
    expect(look.detail).toContain("ravi lindholm (named in the question)");
    expect(look.detail).toContain("meets on Tuesday");
    expect(look.detail).not.toContain("no entity named in the question");
  });

  it("memory.rememberEntity takes aliases up front and reports each one; a clash is reported, not hidden", async () => {
    const mem = new EntityMemory(pool!, audit);
    const tools = entityMemoryTools(mem);
    const tool = (n: string) => tools.find((t) => t.name === n)!;
    await tool("memory.rememberEntity").run({ kind: "person", name: "pavel bergstrom", aliases: ["pavel"] });
    const r = await tool("memory.rememberEntity").run({ kind: "person", name: "pavel hoffmann", aliases: ["pavel", "hoff"] });
    expect(r.ok).toBe(true);
    expect(r.summary).toContain("alias 'hoff' recorded");
    expect(r.summary).toContain("already names 'pavel bergstrom'");
    expect((await mem.recall("hoff"))!.entity.name).toBe("pavel hoffmann");
    expect((await mem.recall("pavel"))!.entity.name).toBe("pavel bergstrom");
  });
});
