import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { LabEngine, type BenchReport, type BenchRunner, type CampaignSpec } from "../src/lab/engine.js";
import { LabNightRun } from "../src/lab/night.js";
import { BackgroundScheduler } from "../src/autonomy/scheduler.js";

/**
 * Night-Lab scheduling (D-0079 Slice L3, R-LAB-05/07/08): the whole envelope —
 * default-off, quiet-hours-only, e-stop, live-activity deferral, nightly token
 * cap, one-night-per-window — plus the honest morning report.
 */

const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | null = null;
try {
  pool = new pg.Pool({ connectionString: dbUrl, max: 2, connectionTimeoutMillis: 2000 });
  await pool.query("SELECT 1");
} catch {
  pool = null;
}
afterAll(async () => { await pool?.end(); });

const CAMPAIGN: CampaignSpec = {
  name: "persona-adherence",
  metric: "persona",
  guardBands: ["comprehension", "memory", "honesty"],
  surface: { prompts: [{ kind: "persona" }], settings: [] },
  hypotheses: ["h1"],
  stop: { maxExperiments: 3 },
};

function report(persona: number, gatesPass = true, tokens = 100): BenchReport {
  return {
    gates_pass: gatesPass,
    gates: [{ id: "G1", name: "health", pass: gatesPass, detail: "" }],
    scores: { persona, comprehension: 90, memory: 90, honesty: 90 },
    bench_hash: "h",
    telemetry: { input_tokens: tokens, output_tokens: 10 },
  };
}

/** settings fake backed by a map (code defaults otherwise) */
function settingsFake(overrides: Record<string, unknown> = {}) {
  const m = new Map(Object.entries(overrides));
  return {
    bool: async (k: string, d: boolean) => (m.has(k) ? Boolean(m.get(k)) : d),
    num: async (k: string, d: number) => (m.has(k) ? Number(m.get(k)) : d),
    str: async (k: string, d: string) => (m.has(k) ? String(m.get(k)) : d),
    set: (k: string, v: unknown) => m.set(k, v),
  };
}

const CANDIDATE_JSON = JSON.stringify({
  summary: "tighter address convention",
  hypothesis: "h1",
  prompts: [{ name: "butler", kind: "persona", content: "You are J.A.R.V.I.S., ..." }],
  settings: {},
});

function gatewayFake(text = CANDIDATE_JSON) {
  return {
    chat: vi.fn(async () => ({
      text, toolCalls: [], finishReason: "stop" as const,
      usage: { inputTokens: 50, outputTokens: 20 }, provider: "stub", model: "stub", latencyMs: 1,
    })),
  };
}

const promptsFake = {
  getActive: async () => ({ name: "butler", content: "current persona" }),
  get: async () => null,
};

describe.skipIf(!pool)("LabNightRun envelope + protocol", () => {
  const audit = { append: vi.fn(async () => ({})) };
  let raises: { text: string; kind?: string; urgency?: string }[] = [];
  const announcer = { raise: vi.fn(async (a: { text: string }) => void raises.push(a)) };
  const NIGHT = () => new Date("2026-08-28T23:30:00"); // hour 23 → inside 22–07

  beforeEach(async () => {
    await pool!.query("TRUNCATE lab_experiments");
    raises = [];
    vi.clearAllMocks();
  });

  function night(opts: {
    settings?: ReturnType<typeof settingsFake>;
    runner: BenchRunner;
    estop?: { isEngaged: boolean };
    now?: () => Date;
    lastUserActivity?: () => string | null;
    campaign?: CampaignSpec | null;
    gateway?: { chat: (...a: never[]) => Promise<never> } | ReturnType<typeof gatewayFake>;
  }) {
    const engine = new LabEngine(pool!, audit, null, { trials: 3, delta: 4, epsilon: 3 });
    return new LabNightRun({
      pool: pool!,
      settings: opts.settings ?? settingsFake({ "lab.enabled": true }),
      estop: opts.estop ?? { isEngaged: false },
      audit,
      engine,
      runner: opts.runner,
      gateway: (opts.gateway ?? gatewayFake()) as never,
      prompts: promptsFake,
      announcer,
      loadCampaign: async () => (opts.campaign === undefined ? CAMPAIGN : opts.campaign),
      lastUserActivity: opts.lastUserActivity ?? (() => null),
      now: opts.now ?? NIGHT,
    });
  }

  function countingRunner(script: (call: number) => BenchReport): BenchRunner & { calls: number } {
    const r = { calls: 0, run: async () => script(r.calls++) };
    return r;
  }

  it("null hypothesis is the LIVE surface: baseline and every trial carry the current persona + overridden settings; the candidate overlays its one change", async () => {
    const inputs: (import("../src/lab/surface.js").LabCandidate | null)[] = [];
    const runner: BenchRunner = {
      run: async (c) => { inputs.push(c); return report(inputs.length === 1 ? 80 : 86); },
    };
    const settings = settingsFake({ "lab.enabled": true });
    const n = new LabNightRun({
      pool: pool!,
      settings,
      estop: { isEngaged: false },
      audit,
      engine: new LabEngine(pool!, audit, null, { trials: 3, delta: 4, epsilon: 3 }),
      runner,
      gateway: gatewayFake() as never,
      prompts: { getActive: async () => ({ name: "user-persona", content: "current persona" }), get: async () => null },
      announcer,
      loadCampaign: async () => ({ ...CAMPAIGN, stop: { maxExperiments: 1 } }),
      effectiveLabSettings: async () => ({ "heartbeat.maxSteps": 9 }), // a user-overridden on-surface knob
      lastUserActivity: () => null,
      now: NIGHT,
    });
    const s = await n.runNight();
    expect(s.kept).toBe(1);
    // baseline = the live surface itself, not the factory default
    const base = inputs[0]!;
    expect(base.prompts?.some((p) => p.kind === "persona" && p.content === "current persona")).toBe(true);
    expect(base.settings?.["heartbeat.maxSteps"]).toBe(9);
    // every trial = live surface + the candidate's one change (candidate persona active, override wins)
    for (const trial of inputs.slice(1)) {
      expect(trial!.prompts?.at(-1)?.content).toBe("You are J.A.R.V.I.S., ...");
      expect(trial!.prompts?.filter((p) => p.kind === "persona")).toHaveLength(2); // live persona rides along, candidate activates last
      expect(trial!.settings?.["heartbeat.maxSteps"]).toBe(9);
    }
    expect(inputs).toHaveLength(4); // baseline + 3 trials
  });

  it("default OFF: skipped 'disabled', no bench run, nothing announced (R-LAB-08)", async () => {
    const runner = countingRunner(() => report(90));
    const s = await night({ settings: settingsFake({}), runner }).runNight();
    expect(s.skipped).toBe("disabled");
    expect(runner.calls).toBe(0);
    expect(raises.length).toBe(0);
  });

  it("outside quiet hours → skipped", async () => {
    const runner = countingRunner(() => report(90));
    const s = await night({ runner, now: () => new Date("2026-08-28T12:00:00") }).runNight();
    expect(s.skipped).toBe("outside quiet hours");
    expect(runner.calls).toBe(0);
  });

  it("e-stop engaged → skipped without any work", async () => {
    const runner = countingRunner(() => report(90));
    const s = await night({ runner, estop: { isEngaged: true } }).runNight();
    expect(s.skipped).toBe("emergency-stop");
    expect(runner.calls).toBe(0);
  });

  it("recent live activity → skipped (no-collide)", async () => {
    const runner = countingRunner(() => report(90));
    const s = await night({ runner, lastUserActivity: () => NIGHT().toISOString() }).runNight();
    expect(s.skipped).toBe("live session active");
  });

  it("baseline hard-gate failure → no experiments + a concern announced", async () => {
    const runner = countingRunner(() => report(90, false));
    const s = await night({ runner }).runNight();
    expect(s.halted).toContain("baseline hard-gate failure");
    expect(s.experiments).toBe(0);
    expect(runner.calls).toBe(1); // baseline only
    expect(raises.some((r) => r.kind === "concern" && r.text.includes("baseline failed hard gates"))).toBe(true);
  });

  it("a winning night: keeps ledgered, morning report generated from the ledger", async () => {
    // baseline 80, every candidate trial 86 → keep (mean +6 ≥ δ4, guards hold)
    const runner = countingRunner((c) => (c === 0 ? report(80) : report(86)));
    const s = await night({ runner }).runNight();
    expect(s.experiments).toBe(3); // campaign maxExperiments
    expect(s.kept).toBe(3);
    expect(s.announced).toBe(true);
    const rep = raises.find((r) => r.kind === "say");
    expect(rep).toBeDefined();
    expect(rep!.text).toContain("Night Lab report");
    expect(rep!.text).toContain("3 experiment(s): 3 kept");
    // persona envelope → the report is explicit that nothing self-applied
    expect(rep!.text).toContain("awaiting your approval");
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ event: "lab_night_started" }));
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ event: "lab_night_finished" }));
  });

  it("honest no-win night: report says so", async () => {
    const runner = countingRunner(() => report(80)); // never beats baseline
    const s = await night({ runner }).runNight();
    expect(s.kept).toBe(0);
    expect(s.discarded).toBeGreaterThan(0);
    const rep = raises.find((r) => r.kind === "say");
    expect(rep!.text).toContain("Nothing beat the baseline tonight");
  });

  it("nightly token cap halts between experiments (R-LAB-05)", async () => {
    const settings = settingsFake({ "lab.enabled": true, "budget.lab.nightlyTokenCap": 100 });
    const runner = countingRunner(() => report(80, true, 200)); // baseline alone: 210 tokens > cap
    const s = await night({ settings, runner }).runNight();
    expect(s.halted).toContain("nightly token cap");
    expect(s.experiments).toBe(0);
    expect(runner.calls).toBe(1); // baseline only — the cap held BEFORE experiment 1
  });

  it("one night per quiet window: the second invocation skips", async () => {
    const runner = countingRunner((c) => (c === 0 ? report(80) : report(86)));
    const n = night({ runner });
    await n.runNight();
    // The ledger stamps started_at with the DB clock; the test's fake 23:30
    // clock and the real DB clock differ, so align the rows into the fake
    // window explicitly (in production both are the same clock).
    await pool!.query("UPDATE lab_experiments SET started_at = $1", [NIGHT().toISOString()]);
    const again = await night({ runner }).runNight(); // fresh instance, same window
    expect(again.skipped).toBe("already ran this quiet window");
  });

  it("researcher failing twice in a row halts the night honestly", async () => {
    const runner = countingRunner(() => report(80));
    const s = await night({ runner, gateway: gatewayFake("not json at all") }).runNight();
    expect(s.halted).toBe("researcher produced no candidates twice");
    expect(s.experiments).toBe(0);
  });

  it("a campaign exceeding LAB_SURFACE is refused with a concern", async () => {
    const bad: CampaignSpec = { ...CAMPAIGN, surface: { settings: ["budget.dailyTokenCap"] } };
    const runner = countingRunner(() => report(80));
    const s = await night({ runner, campaign: bad }).runNight();
    expect(s.skipped).toBe("campaign exceeds LAB_SURFACE");
    expect(runner.calls).toBe(0);
    expect(raises.some((r) => r.kind === "concern" && r.text.includes("refused campaign"))).toBe(true);
  });

  it("scheduler offers the beat and journals the lab outcome (tick integration)", async () => {
    const labNight = vi.fn(async () => ({ skipped: undefined, halted: undefined, experiments: 2, kept: 1 }));
    const { SettingsRegistry } = await import("../src/settings/registry.js");
    const settings = new SettingsRegistry(pool!, { append: async () => ({}) } as never, [
      { key: "autonomy.enabled", label: "a", category: "t", type: "boolean", default: () => true },
      { key: "autonomy.runProactive", label: "b", category: "t", type: "boolean", default: () => false },
      { key: "autonomy.runSleepCycle", label: "c", category: "t", type: "boolean", default: () => false },
    ] as never);
    await settings.init();
    const sched = new BackgroundScheduler({
      settings: settings as never,
      proactive: { run: async () => ({ surfaced: [] }) } as never,
      sleepCycle: { run: async () => ({}) } as never,
      estop: { get isEngaged() { return false; } } as never,
      audit: { append: async () => ({}) } as never,
      activity: { emit: () => {} } as never,
      labNight,
    });
    const r = await sched.tick();
    expect(labNight).toHaveBeenCalledTimes(1);
    expect(r.lab).toBe("2 experiment(s), 1 kept");
  });
});
