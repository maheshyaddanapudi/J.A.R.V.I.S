import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Projects, projectTools } from "../src/autonomy/projects.js";
import { Vault } from "../src/crypto/vault.js";
import type { AuditLog } from "../src/core/audit.js";

/** Durable projects (D-0069): a goal worked across heartbeats — encrypted at rest,
 *  resumable next-action state, secret-refusing. */
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });
const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const vault = await Vault.open(join(tmpdir(), `jarvis-proj-${randomBytes(6).toString("hex")}.json`), randomBytes(32)).catch(() => undefined);

describe.skipIf(!pool)("Projects (D-0069) — durable long-horizon goals", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE projects, project_log CASCADE"); });

  it("start → active → note (resumable next action) → complete; log preserved", async () => {
    const pr = new Projects(pool!, audit, vault);
    const p = await pr.start({ title: "Optimize the reactor", goal: "raise efficiency to 90%", nextAction: "profile current output", createdBy: "user" });
    expect((await pr.active()).map((x) => x.id)).toContain(p.id);
    // advance a step; next action is updated so a future heartbeat resumes
    expect(await pr.note(p.id, "profiled: 72% baseline", "model the palladium-free core")).toBe(true);
    const active = (await pr.active())[0]!;
    expect(active.nextAction).toBe("model the palladium-free core");
    const log = await pr.log(p.id);
    expect(log.map((l) => l.entry)).toContain("profiled: 72% baseline");
    // complete
    expect(await pr.setStatus(p.id, "done", "hit 90%")).toBe(true);
    expect(await pr.active()).toHaveLength(0);
    expect((await pr.list("done")).map((x) => x.id)).toContain(p.id);
  });

  it("goal + progress are ENCRYPTED at rest (DB holds ciphertext, 0 plaintext)", async () => {
    const pr = new Projects(pool!, audit, vault);
    const p = await pr.start({ title: "Secret plan", goal: "the palladium substitute formula", createdBy: "user" });
    await pr.note(p.id, "found the vibranium route");
    const { rows: g } = await pool!.query("SELECT goal FROM projects WHERE id=$1", [p.id]);
    const { rows: l } = await pool!.query("SELECT entry FROM project_log WHERE project_id=$1", [p.id]);
    expect(g[0].goal).toMatch(/^v1\.gcm\./);
    expect(l.some((r) => r.entry.includes("vibranium"))).toBe(false); // no plaintext in the log
    // …but recall decrypts
    expect((await pr.list("active"))[0]!.goal).toBe("the palladium substitute formula");
  });

  it("refuses a secret-shaped goal (R-MEM-06)", async () => {
    const pr = new Projects(pool!, audit, vault);
    await expect(pr.start({ title: "x", goal: "api key sk-ant-api03-abcdefghij1234567890", createdBy: "user" })).rejects.toThrow(/secret/);
  });

  it("project tools: start + list + note through the gated-tool surface", async () => {
    const pr = new Projects(pool!, audit, vault);
    const tools = projectTools(pr);
    const start = tools.find((t) => t.name === "project.start")!;
    const r = await start.run({ title: "Ship v2", goal: "release the suit firmware" }, {} as never);
    const id = (r.data as { id: string }).id;
    const list = tools.find((t) => t.name === "project.list")!;
    expect(String((await list.run({}, {} as never)).detail)).toMatch(/Ship v2/);
    const note = tools.find((t) => t.name === "project.note")!;
    expect((await note.run({ id, progress: "compiled" }, {} as never)).ok).toBe(true);
  });
});
