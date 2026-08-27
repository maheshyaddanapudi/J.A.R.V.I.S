import { describe, expect, it, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ops } from "../src/ops/ops.js";
import { AuditLog } from "../src/core/audit.js";
import type { SettingsRegistry } from "../src/settings/registry.js";

/** Longevity ops (D-0071): self-health/watchdog + brain backup/restore. */
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });

const settings = (enabled: boolean, interval = 30) => ({
  bool: async (k: string, f: boolean) => (k === "autonomy.enabled" ? enabled : f),
  num: async (k: string, f: number) => (k === "autonomy.intervalMinutes" ? interval : f),
}) as unknown as SettingsRegistry;

describe.skipIf(!pool)("Ops (D-0071) — longevity", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE memory_entities, memory_facts, memory_relations, memory_episodes, agenda_items, projects, project_log, heartbeats CASCADE");
  });

  it("health() reports DB latency, audit integrity, memory sizes, and NOT stale when fresh", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jarvis-ops-"));
    const audit = new AuditLog(pool!);
    await pool!.query("INSERT INTO heartbeats (at, summary) VALUES (now(), 'fresh beat')");
    const ops = new Ops(pool!, audit, settings(true, 30), dir);
    const h = await ops.health();
    expect(h.db.ok).toBe(true);
    expect(h.audit.intact).toBe(true);
    expect(h.autonomy.stale).toBe(false); // fresh beat
    expect(h.ok).toBe(true);
  });

  it("health() counts real episodes (regression: episodes use epistemic_status, never 'active')", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jarvis-ops-"));
    const audit = new AuditLog(pool!);
    await pool!.query("INSERT INTO heartbeats (at, summary) VALUES (now(), 'fresh beat')");
    await pool!.query(
      "INSERT INTO memory_episodes (kind, summary, provenance) VALUES ('note','test episode','test'), ('note','deleted episode','test')",
    );
    await pool!.query("UPDATE memory_episodes SET status = 'deleted' WHERE summary = 'deleted episode'");
    const ops = new Ops(pool!, audit, settings(true, 30), dir);
    const h = await ops.health();
    expect(h.memory.episodes).toBe(1); // the active one only — was always 0 before the fix
  });

  it("WATCHDOG: flags stale when autonomy is on but the last beat is way overdue", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jarvis-ops-"));
    const audit = new AuditLog(pool!);
    await pool!.query("INSERT INTO heartbeats (at, summary) VALUES (now() - interval '5 hours', 'old beat')");
    const ops = new Ops(pool!, audit, settings(true, 30), dir); // 30-min interval → stale > 90 min
    const h = await ops.health();
    expect(h.autonomy.stale).toBe(true);
    expect(h.ok).toBe(false);
  });

  it("backup → restore ROUND-TRIP recovers the brain into an empty DB (ciphertext preserved)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jarvis-ops-"));
    const audit = new AuditLog(pool!);
    const ops = new Ops(pool!, audit, settings(false), dir);
    // seed a small brain
    await pool!.query("INSERT INTO memory_entities (kind, name, attributes, status, provenance) VALUES ('person','Tony','v1.gcm.CIPHERTEXT','user_statement','test')");
    await pool!.query("INSERT INTO projects (title, goal, created_by) VALUES ('P','v1.gcm.GOAL','user')");
    const b = await ops.backup("test");
    expect(b.rows).toBeGreaterThanOrEqual(2);
    expect(b.sha256).toMatch(/^[0-9a-f]{64}$/);
    // wipe, then restore into the now-empty brain
    await pool!.query("TRUNCATE memory_entities, projects CASCADE");
    const r = await ops.restore(b.path);
    expect(r.restored).toBeGreaterThanOrEqual(2);
    const { rows } = await pool!.query("SELECT name, attributes FROM memory_entities WHERE name='Tony'");
    expect(rows[0].attributes).toBe("v1.gcm.CIPHERTEXT"); // ciphertext round-tripped, key never in the backup
  });

  it("restore REFUSES a non-empty target without force (no accidental overwrite)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jarvis-ops-"));
    const audit = new AuditLog(pool!);
    const ops = new Ops(pool!, audit, settings(false), dir);
    await pool!.query("INSERT INTO memory_entities (kind, name, status, provenance) VALUES ('person','A','user_statement','t')");
    const b = await ops.backup();
    await expect(ops.restore(b.path)).rejects.toThrow(/not empty/);
  });
});
