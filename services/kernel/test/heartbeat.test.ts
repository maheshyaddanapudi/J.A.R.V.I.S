import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { Agenda, agendaTools } from "../src/autonomy/agenda.js";
import { BackgroundScheduler } from "../src/autonomy/scheduler.js";
import { SettingsRegistry, type SettingSpec } from "../src/settings/registry.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { ActivityBus } from "../src/core/activity.js";
import type { ProactivityEngine } from "../src/proactive/engine.js";
import type { SleepCycle } from "../src/core/consolidation.js";
import type { AgentRuntime, AgentRunOptions } from "../src/agent/contract.js";

/**
 * The living heartbeat (D-0064): J.A.R.V.I.S. writes its OWN agenda; each tick
 * reviews it, thinks within the safety ceiling (≤ LOW_REVERSIBLE auto; anything
 * consequential DENIED), and journals the beat — alive between conversations,
 * observably.
 */

const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const estop = { get isEngaged() { return false; } } as unknown as EmergencyStop;
const activity = { emit: vi.fn() } as unknown as ActivityBus;
const proactive = { run: vi.fn(async () => ({ surfaced: [] })) } as unknown as ProactivityEngine;
const sleepCycle = { run: vi.fn(async () => ({})) } as unknown as SleepCycle;
const catalog: SettingSpec[] = []; // heartbeat settings resolve to code defaults

describe.skipIf(!pool)("Agenda (D-0064) — J.A.R.V.I.S.'s own intention ledger", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE agenda_items, heartbeats"); });

  it("add → due → complete round-trip; dropped items record why; secrets are redacted", async () => {
    const agenda = new Agenda(pool!, audit);
    const a = await agenda.add({ what: "check the reactor telemetry", why: "spike last night", provenance: "jarvis" });
    const b = await agenda.add({ what: "buy a present", dueAt: new Date(Date.now() + 86400e3).toISOString(), provenance: "user" });
    const due = await agenda.due();
    expect(due.map((i) => i.id)).toContain(a.id);      // no due date = next heartbeat
    expect(due.map((i) => i.id)).not.toContain(b.id);  // future-dated not yet due
    expect(await agenda.resolve(a.id, "done", "telemetry nominal")).toBe(true);
    expect(await agenda.resolve(a.id, "done", "again")).toBe(false); // already resolved
    const s = await agenda.add({ what: "note api_key=sk-ant-api03-abcdefghij1234567890", provenance: "jarvis" });
    expect(s.what).not.toContain("sk-ant"); // secret-shaped content never stored
  });

  it("heartbeat tick: reviews due agenda, thinks via the agent with the LOW_REVERSIBLE ceiling, journals the beat", async () => {
    const agenda = new Agenda(pool!, audit);
    await agenda.add({ what: "summarise yesterday", provenance: "jarvis" });
    const seen: { objective?: string; opts?: AgentRunOptions } = {};
    const agent: AgentRuntime = {
      async run(objective, opts) {
        seen.objective = objective; seen.opts = opts;
        return {
          objective, answer: "Reviewed the agenda; all quiet.", stepsUsed: 1, budgetExhausted: false, halted: false,
          steps: [{ index: 0, tool: "agenda.complete", args: {}, ok: true, summary: "done" }],
        };
      },
    };
    const settings = new SettingsRegistry(pool!, audit, catalog);
    const sched = new BackgroundScheduler({
      settings: { // enabled, defaults for the rest
        bool: async (k: string, f: boolean) => (k === "autonomy.enabled" ? true : f),
        num: async (_k: string, f: number) => f,
        str: async (_k: string, f: string) => f,
      } as unknown as SettingsRegistry,
      proactive, sleepCycle, estop, audit, activity, agenda, agent, pool: pool!,
    });
    const r = await sched.tick();
    expect(r.agendaReviewed).toBe(1);
    expect(r.brainUsed).toBe(true);
    expect(r.agendaCompleted).toBe(1);
    // the model was told it's on its own time, given the agenda, and CAPPED
    expect(seen.objective).toMatch(/HEARTBEAT/);
    expect(seen.objective).toMatch(/summarise yesterday/);
    expect(seen.opts?.approvalCeiling).toBe("LOW_REVERSIBLE");
    expect(seen.opts?.source).toBe("heartbeat");
    // the beat was journaled (persisted, observable)
    const { rows } = await pool!.query("SELECT brain_used, agenda_reviewed, summary FROM heartbeats");
    expect(rows).toHaveLength(1);
    expect(rows[0].brain_used).toBe(true);
    expect(rows[0].summary).toMatch(/all quiet/);
    void settings;
  });

  it("heartbeat.brain=off → no thinking, but the beat is still journaled", async () => {
    const agenda = new Agenda(pool!, audit);
    await agenda.add({ what: "anything", provenance: "jarvis" });
    const agent: AgentRuntime = { run: vi.fn(async () => { throw new Error("must not be called"); }) };
    const sched = new BackgroundScheduler({
      settings: {
        bool: async (k: string, f: boolean) => (k === "autonomy.enabled" ? true : f),
        num: async (_k: string, f: number) => f,
        str: async (k: string, f: string) => (k === "heartbeat.brain" ? "off" : f),
      } as unknown as SettingsRegistry,
      proactive, sleepCycle, estop, audit, activity, agenda, agent, pool: pool!,
    });
    const r = await sched.tick();
    expect(r.brainUsed).toBe(false);
    expect(r.agendaReviewed).toBe(1);
    expect((await pool!.query("SELECT count(*) FROM heartbeats")).rows[0].count).toBe("1");
  });

  it("NO-COLLIDE (D-0065): a beat defers its brain pass while a live session is active", async () => {
    const agenda = new Agenda(pool!, audit);
    await agenda.add({ what: "anything due", provenance: "jarvis" });
    const agent: AgentRuntime = { run: vi.fn(async () => { throw new Error("must not think while user is active"); }) };
    const sched = new BackgroundScheduler({
      settings: {
        bool: async (k: string, f: boolean) => (k === "autonomy.enabled" ? true : f),
        num: async (_k: string, f: number) => f, // deferWhileActiveMinutes default 5
        str: async (_k: string, f: string) => f,
      } as unknown as SettingsRegistry,
      proactive, sleepCycle, estop, audit, activity, agenda, agent, pool: pool!,
      lastUserActivity: () => new Date().toISOString(), // user active RIGHT NOW
    });
    const r = await sched.tick();
    expect(r.brainUsed).toBe(false);          // beat stayed quiet
    expect(r.agendaReviewed).toBe(1);         // agenda intact for the next beat
    const { rows } = await pool!.query("SELECT summary FROM heartbeats ORDER BY at DESC LIMIT 1");
    expect(rows[0].summary).toMatch(/deferred — live session active/);
  });

  it("THREE RHYTHMS (D-0065): sleep-cycle confined to the quiet-hours window when opted in", async () => {
    const agenda = new Agenda(pool!, audit);
    const mkSched = (hour: number) => new BackgroundScheduler({
      settings: {
        bool: async (k: string, f: boolean) =>
          k === "autonomy.enabled" ? true : k === "sleep.useQuietHours" ? true : f,
        num: async (_k: string, f: number) => f, // quietHours 22→7 defaults
        str: async (k: string, f: string) => (k === "heartbeat.brain" ? "off" : f),
      } as unknown as SettingsRegistry,
      proactive, sleepCycle, estop, audit, activity, agenda, pool: pool!,
      now: () => new Date(2026, 6, 19, hour, 30, 0),
    });
    (sleepCycle.run as ReturnType<typeof vi.fn>).mockClear();
    const daytime = await mkSched(14).tick();     // 14:30 — outside 22→7
    expect(daytime.consolidated).toBe(false);     // heartbeat stays LIGHT by day
    const night = await mkSched(23).tick();       // 23:30 — inside the window
    expect(night.consolidated).toBe(true);        // deep work happens at night
    expect(sleepCycle.run).toHaveBeenCalledTimes(1);
  });

  it("agenda tools registerable + agenda.add tool redacts and returns the item", async () => {
    const agenda = new Agenda(pool!, audit);
    const tools = agendaTools(agenda);
    expect(tools.map((t) => t.name)).toEqual(["agenda.add", "agenda.list", "agenda.complete", "agenda.drop"]);
    const add = tools.find((t) => t.name === "agenda.add")!;
    const r = await add.run({ what: "water the plants" }, {} as never);
    expect(r.ok).toBe(true);
    const list = tools.find((t) => t.name === "agenda.list")!;
    const l = await list.run({}, {} as never);
    expect(String(l.detail)).toMatch(/water the plants/);
  });
});
