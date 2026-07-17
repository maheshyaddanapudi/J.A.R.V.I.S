import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { MemoryService } from "../src/memory/memory.js";
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

describe.skipIf(!pool)("MemoryService (integration)", () => {
  const mem = new MemoryService(pool!, audit);

  beforeEach(async () => {
    await pool!.query("TRUNCATE preferences, conversation_memory");
  });
  afterAll(async () => {
    await pool!.end();
  });

  it("remembers, retrieves, and carries provenance + epistemic status", async () => {
    const p = await mem.remember({ key: "coffee", value: "flat white", provenance: "chat" });
    expect(p.status).toBe("user_statement");
    expect(p.provenance).toBe("chat");
    const got = await mem.get("coffee");
    expect(got?.value).toBe("flat white");
  });

  it("correcting supersedes the old row (history preserved) and returns new value", async () => {
    await mem.remember({ key: "coffee", value: "flat white", provenance: "chat" });
    const corrected = await mem.correct("coffee", "espresso");
    expect(corrected?.value).toBe("espresso");
    expect((await mem.get("coffee"))?.value).toBe("espresso");
    // exactly one active row for the key
    const active = (await mem.list()).filter((r) => r.key === "coffee");
    expect(active).toHaveLength(1);
    // superseded history is retained
    const all = await mem.list(true);
    expect(all.filter((r) => r.key === "coffee" && r.status === "superseded")).toHaveLength(1);
  });

  it("delete excludes from retrieval immediately", async () => {
    await mem.remember({ key: "coffee", value: "flat white", provenance: "chat" });
    expect(await mem.delete("coffee")).toBe(true);
    expect(await mem.get("coffee")).toBeNull();
    expect((await mem.list()).some((r) => r.key === "coffee")).toBe(false);
  });

  it("forget physically purges", async () => {
    await mem.remember({ key: "coffee", value: "flat white", provenance: "chat" });
    await mem.delete("coffee");
    const purged = await mem.forget("coffee");
    expect(purged).toBeGreaterThan(0);
    const { rows } = await pool!.query("SELECT count(*)::int AS n FROM preferences WHERE key='coffee'");
    expect(rows[0].n).toBe(0);
  });

  it("refuses to store secrets in memory (R-MEM-06)", async () => {
    await expect(
      mem.remember({ key: "api", value: "api_key=sk-supersecret999", provenance: "chat" }),
    ).rejects.toThrow(/secret/);
  });

  it("pin and search work", async () => {
    await mem.remember({ key: "coffee", value: "flat white", provenance: "chat" });
    await mem.remember({ key: "tea", value: "earl grey", provenance: "chat" });
    expect(await mem.pin("tea", true)).toBe(true);
    const results = await mem.search("grey");
    expect(results.map((r) => r.key)).toContain("tea");
    const listed = await mem.list();
    expect(listed[0]!.key).toBe("tea"); // pinned first
  });

  it("conversation turns persist and return in order", async () => {
    const s = "00000000-0000-0000-0000-000000000001";
    await mem.addTurn(s, "user", "hello");
    await mem.addTurn(s, "assistant", "good evening");
    const convo = await mem.conversation(s);
    expect(convo.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(convo[0]!.content).toBe("hello");
  });

  it("redacts secrets from conversation content", async () => {
    const s = "00000000-0000-0000-0000-000000000002";
    await mem.addTurn(s, "user", "my token = topsecretvalue123 ok?");
    const convo = await mem.conversation(s);
    expect(convo[0]!.content).not.toContain("topsecretvalue123");
  });
});
