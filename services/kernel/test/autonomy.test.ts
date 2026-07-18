import { describe, expect, it, vi } from "vitest";
import { BackgroundScheduler } from "../src/autonomy/scheduler.js";
import { DurableGrants } from "../src/core/grants.js";
import { ActivityBus } from "../src/core/activity.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { SettingsRegistry } from "../src/settings/registry.js";
import type { ProactivityEngine } from "../src/proactive/engine.js";
import type { SleepCycle } from "../src/core/consolidation.js";

/**
 * Background autonomy (D-0024) safety envelope + durable-grant persistence
 * (D-0059). The scheduler runs only the two safe cycles, is default-off,
 * e-stop-aware, and never touches consequential execution.
 */

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

/** In-memory settings double exposing just what the scheduler reads. */
function fakeSettings(values: Record<string, unknown>): SettingsRegistry {
  return {
    async bool(k: string, fb: boolean) { return typeof values[k] === "boolean" ? (values[k] as boolean) : fb; },
    async num(k: string, fb: number) { return typeof values[k] === "number" ? (values[k] as number) : fb; },
    async str(k: string, fb: string) { return typeof values[k] === "string" ? (values[k] as string) : fb; },
  } as unknown as SettingsRegistry;
}

function makeScheduler(opts: {
  settings: Record<string, unknown>;
  estopEngaged?: boolean;
  proactiveSurfaced?: number;
}) {
  const proactiveRun = vi.fn(async () => ({ surfaced: Array(opts.proactiveSurfaced ?? 0).fill({}), suppressed: [] }));
  const sleepRun = vi.fn(async () => ({}) as unknown);
  const estop = { get isEngaged() { return Boolean(opts.estopEngaged); } } as unknown as EmergencyStop;
  const s = new BackgroundScheduler({
    settings: fakeSettings(opts.settings),
    proactive: { run: proactiveRun } as unknown as ProactivityEngine,
    sleepCycle: { run: sleepRun } as unknown as SleepCycle,
    estop, audit, activity: new ActivityBus(),
    now: () => new Date("2026-07-18T10:00:00Z"),
  });
  return { s, proactiveRun, sleepRun };
}

describe("BackgroundScheduler (D-0024) — safety envelope", () => {
  it("does NOTHING when disabled (default off)", async () => {
    const { s, proactiveRun, sleepRun } = makeScheduler({ settings: { "autonomy.enabled": false } });
    const r = await s.tick();
    expect(r.skipped).toBe("disabled");
    expect(proactiveRun).not.toHaveBeenCalled();
    expect(sleepRun).not.toHaveBeenCalled();
  });

  it("when enabled, runs proactivity + sleep-cycle and reports", async () => {
    const { s, proactiveRun, sleepRun } = makeScheduler({
      settings: { "autonomy.enabled": true, "autonomy.runProactive": true, "autonomy.runSleepCycle": true },
      proactiveSurfaced: 2,
    });
    const r = await s.tick();
    expect(proactiveRun).toHaveBeenCalledOnce();
    expect(sleepRun).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ proactiveSurfaced: 2, consolidated: true });
  });

  it("e-stop halts a tick (even when enabled)", async () => {
    const { s, proactiveRun } = makeScheduler({ settings: { "autonomy.enabled": true }, estopEngaged: true });
    const r = await s.tick();
    expect(r.skipped).toBe("emergency-stop");
    expect(proactiveRun).not.toHaveBeenCalled();
  });

  it("honors per-cycle toggles", async () => {
    const { s, proactiveRun, sleepRun } = makeScheduler({
      settings: { "autonomy.enabled": true, "autonomy.runProactive": true, "autonomy.runSleepCycle": false },
    });
    await s.tick();
    expect(proactiveRun).toHaveBeenCalledOnce();
    expect(sleepRun).not.toHaveBeenCalled();
  });

  it("a cycle throwing never crashes the tick", async () => {
    const settings = fakeSettings({ "autonomy.enabled": true, "autonomy.runProactive": true, "autonomy.runSleepCycle": false });
    const s = new BackgroundScheduler({
      settings,
      proactive: { run: vi.fn(async () => { throw new Error("boom"); }) } as unknown as ProactivityEngine,
      sleepCycle: { run: vi.fn() } as unknown as SleepCycle,
      estop: { get isEngaged() { return false; } } as unknown as EmergencyStop,
      audit, activity: new ActivityBus(), now: () => new Date("2026-07-18T10:00:00Z"),
    });
    const r = await s.tick();
    expect(r.proactiveSurfaced).toBe(0); // swallowed, no throw
  });

  it("status reflects enabled + interval from settings", async () => {
    const { s } = makeScheduler({ settings: { "autonomy.enabled": true, "autonomy.intervalMinutes": 15 } });
    const st = await s.status();
    expect(st).toMatchObject({ enabled: true, intervalMinutes: 15, running: false });
  });
});

// ---- durable-grant persistence (D-0059) ----
import pg from "pg";
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }

describe.skipIf(!pool)("DurableGrants (D-0059) — standing consent persists", () => {
  it("remember → load → list → revoke round-trips (survives a fresh instance)", async () => {
    await pool!.query("TRUNCATE durable_grants");
    const g = new DurableGrants(pool!, audit);
    await g.remember("web.open", "https://stark.com/*", "CONSEQUENTIAL");
    await g.remember("web.open", "https://stark.com/*", "CONSEQUENTIAL"); // idempotent
    // a FRESH instance (simulates restart) loads the durable grant
    const loaded = await new DurableGrants(pool!, audit).load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ tool: "web.open", scope: "https://stark.com/*", kind: "always-allow-in-scope" });
    const list = await g.list();
    expect(await g.revoke(list[0]!.id)).toBe(true);
    expect(await g.load()).toHaveLength(0);
  });
});
