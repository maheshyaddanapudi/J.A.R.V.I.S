import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { PromptRegistry } from "../src/prompts/registry.js";
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

describe.skipIf(!pool)("PromptRegistry (R-CAP-01 prompts kind)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE prompts CASCADE");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("sets a persona, makes it active, and returns it", async () => {
    const reg = new PromptRegistry(pool!, audit);
    const p = await reg.set({ name: "butler", content: "You are J.A.R.V.I.S., a British butler." });
    expect(p.active).toBe(true);
    expect(p.version).toBe(1);
    const active = await reg.getActive("persona");
    expect(active!.name).toBe("butler");
    expect(active!.content).toContain("British butler");
  });

  it("supersedes with an incremented version and keeps only one active persona", async () => {
    const reg = new PromptRegistry(pool!, audit);
    await reg.set({ name: "butler", content: "v1 manner" });
    await reg.set({ name: "butler", content: "v2 manner, more dry wit" });
    const active = await reg.getActive("persona");
    expect(active!.content).toContain("v2");
    expect(active!.version).toBe(2);
    // history preserved, but exactly one active
    const all = await reg.list("persona", true);
    expect(all.length).toBe(2);
    expect(all.filter((p) => p.active).length).toBe(1);
  });

  it("switching to a different persona name deactivates the previous active one", async () => {
    const reg = new PromptRegistry(pool!, audit);
    await reg.set({ name: "butler", content: "formal" });
    await reg.set({ name: "casual", content: "relaxed and friendly" });
    const active = await reg.getActive("persona");
    expect(active!.name).toBe("casual");
    // exactly one active across all names of this kind
    const actives = (await reg.list("persona", true)).filter((p) => p.active);
    expect(actives.length).toBe(1);
    expect(actives[0]!.name).toBe("casual");
  });

  it("activate() switches back to a previously-set persona", async () => {
    const reg = new PromptRegistry(pool!, audit);
    await reg.set({ name: "butler", content: "formal" });
    await reg.set({ name: "casual", content: "relaxed" });
    expect(await reg.activate("butler")).toBe(true);
    expect((await reg.getActive("persona"))!.name).toBe("butler");
    expect(await reg.activate("does-not-exist")).toBe(false);
  });

  it("activePersonaOr falls back to the default when the registry is empty", async () => {
    const reg = new PromptRegistry(pool!, audit);
    const fallback = "DEFAULT BUTLER";
    expect(await reg.activePersonaOr(fallback)).toBe(fallback); // nothing set
    await reg.set({ name: "butler", content: "custom manner" });
    expect(await reg.activePersonaOr(fallback)).toBe("custom manner"); // now uses the active one
  });

  it("redacts secrets on write (a persona must never carry a key)", async () => {
    const reg = new PromptRegistry(pool!, audit);
    const p = await reg.set({ name: "butler", content: "Use api_key=SUPERSECRETVALUE when asked." });
    expect(p.content).not.toContain("SUPERSECRETVALUE");
    expect(p.content).toContain("<REDACTED>");
  });

  it("remove() deletes all versions of a named prompt", async () => {
    const reg = new PromptRegistry(pool!, audit);
    await reg.set({ name: "butler", content: "v1" });
    await reg.set({ name: "butler", content: "v2" });
    expect(await reg.remove("butler")).toBe(true);
    expect(await reg.getActive("persona")).toBeNull();
    expect(await reg.remove("butler")).toBe(false); // idempotent
  });
});
