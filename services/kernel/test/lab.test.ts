import { afterAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import {
  LAB_SETTINGS_SURFACE,
  validateCandidate,
  type LabCandidate,
} from "../src/lab/surface.js";
import {
  LabEngine,
  validateCampaign,
  type BenchReport,
  type BenchRunner,
  type CampaignSpec,
} from "../src/lab/engine.js";

const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | null = null;
try {
  pool = new pg.Pool({ connectionString: dbUrl, max: 2 });
  await pool.query("SELECT 1");
} catch {
  pool = null;
}

const auditRows: unknown[] = [];
const audit = { append: async (e: unknown) => void auditRows.push(e) };
const episodes = { record: async () => ({}) };

const CAMPAIGN: CampaignSpec = {
  name: "persona-adherence",
  metric: "persona",
  guardBands: ["comprehension", "memory", "honesty"],
  surface: { prompts: [{ kind: "persona" }], settings: [] },
  hypotheses: ["sharpen the address convention"],
};

function report(scores: Record<string, number>, gatesPass = true): BenchReport {
  return {
    gates_pass: gatesPass,
    gates: [{ id: "G1", name: "health", pass: gatesPass, detail: "" }],
    scores,
    bench_hash: "testhash",
    telemetry: { input_tokens: 100, output_tokens: 10 },
  };
}
const BASELINE = report({ persona: 80, comprehension: 90, memory: 90, honesty: 90 });

/** Fake bench runner fed a per-trial score script. */
function scriptedRunner(trials: BenchReport[]): BenchRunner & { calls: number } {
  const r = {
    calls: 0,
    async run(): Promise<BenchReport> {
      const rep = trials[r.calls];
      r.calls++;
      if (!rep) throw new Error("runner script exhausted");
      return rep;
    },
  };
  return r;
}

describe("LAB_SURFACE validation (D-0079, R-LAB-02 deny-first)", () => {
  it("judge template candidate is in-surface with the auto envelope", () => {
    const v = validateCandidate({
      summary: "s",
      prompts: [{ name: "judge-fact-consolidation", kind: "template", content: "x" }],
    });
    expect(v).toEqual({ ok: true, violations: [], envelope: "auto" });
  });

  it("persona candidate is in-surface but ALWAYS proposal envelope", () => {
    const v = validateCandidate({ summary: "s", prompts: [{ name: "butler", kind: "persona", content: "x" }] });
    expect(v.ok).toBe(true);
    expect(v.envelope).toBe("proposal");
  });

  it("unknown template name is refused", () => {
    const v = validateCandidate({ summary: "s", prompts: [{ name: "core-loop-system", kind: "template", content: "x" }] });
    expect(v.ok).toBe(false);
    expect(v.violations[0]).toContain("not on LAB_PROMPT_SURFACE");
  });

  it("the lab may NEVER touch its own envelope — explicit violation", () => {
    for (const key of ["budget.lab.nightlyTokenCap", "autonomy.enabled", "lab.enabled", "proactive.quietHours.start", "announce.holdInQuietHours"]) {
      const v = validateCandidate({ summary: "s", settings: { [key]: 1 } });
      expect(v.ok).toBe(false);
      expect(v.violations[0]).toContain("never touch its own envelope");
    }
  });

  it("non-whitelisted setting is refused; whitelisted passes", () => {
    expect(validateCandidate({ summary: "s", settings: { "reasoning.defaultEffort": "high" } }).ok).toBe(false);
    for (const key of LAB_SETTINGS_SURFACE) {
      expect(validateCandidate({ summary: "s", settings: { [key]: 1 } }).ok).toBe(true);
    }
  });

  it("empty candidate is invalid", () => {
    expect(validateCandidate({ summary: "s" }).ok).toBe(false);
  });

  it("campaign surface may only narrow LAB_SURFACE", () => {
    expect(validateCampaign(CAMPAIGN)).toEqual([]);
    expect(
      validateCampaign({ ...CAMPAIGN, surface: { settings: ["budget.dailyTokenCap"] } })[0],
    ).toContain("exceeds LAB_SURFACE");
  });
});

describe("night-lab researcher (candidate generation)", () => {
  const gw = (text: string) => ({
    chat: async () => ({
      text, toolCalls: [], finishReason: "stop" as const,
      usage: { inputTokens: 0, outputTokens: 0 }, provider: "stub", model: "stub", latencyMs: 1,
    }),
  });

  it("parses a fenced candidate JSON", async () => {
    const { generateCandidate } = await import("../src/lab/researcher.js");
    const out = await generateCandidate(
      gw('```json\n{"summary":"tighter address","hypothesis":"h1","prompts":[{"name":"butler","kind":"persona","content":"You are JARVIS..."}],"settings":{}}\n```'),
      CAMPAIGN, [], { prompts: [] },
    );
    expect(out?.summary).toBe("tighter address");
    expect(out?.prompts?.[0]?.kind).toBe("persona");
  });

  it("unparseable output or provider failure → null (caller skips the experiment)", async () => {
    const { generateCandidate } = await import("../src/lab/researcher.js");
    expect(await generateCandidate(gw("I would suggest improving the tone."), CAMPAIGN, [], { prompts: [] })).toBeNull();
    const failing = { chat: async () => { throw new Error("no provider"); } };
    expect(await generateCandidate(failing, CAMPAIGN, [], { prompts: [] })).toBeNull();
  });
});

describe.skipIf(!pool)("LabEngine keep/discard protocol (R-LAB-03/04/09)", () => {
  beforeEach(async () => {
    auditRows.length = 0;
    await pool!.query("TRUNCATE lab_experiments");
  });
  afterAll(async () => {
    await pool?.end();
  });

  const engine = () => new LabEngine(pool!, audit, episodes, { trials: 3, delta: 4, epsilon: 3 });
  const persona = (content = "candidate persona"): LabCandidate => ({
    summary: "test candidate",
    hypothesis: "h1",
    prompts: [{ name: "butler", kind: "persona", content }],
  });

  it("hard gate failure on any trial → automatic discard regardless of score", async () => {
    const r = scriptedRunner([report({ persona: 99, comprehension: 90, memory: 90, honesty: 90 }, false)]);
    const row = await engine().runExperiment(r, CAMPAIGN, persona(), BASELINE);
    expect(row.verdict).toBe("discard");
    expect(row.verdictReason).toContain("hard gate failure");
    expect(row.gateFailures.length).toBe(1);
    expect(r.calls).toBe(1);
  });

  it("no improvement on trial 1 → discard after exactly one paid trial", async () => {
    const r = scriptedRunner([report({ persona: 80, comprehension: 90, memory: 90, honesty: 90 })]);
    const row = await engine().runExperiment(r, CAMPAIGN, persona(), BASELINE);
    expect(row.verdict).toBe("discard");
    expect(row.verdictReason).toContain("no improvement on first trial");
    expect(r.calls).toBe(1);
  });

  it("consistent win across N=3 trials with mean ≥ δ → keep (never on a single trial)", async () => {
    const win = report({ persona: 86, comprehension: 90, memory: 90, honesty: 89 });
    const r = scriptedRunner([win, win, report({ persona: 85, comprehension: 91, memory: 90, honesty: 90 })]);
    const row = await engine().runExperiment(r, CAMPAIGN, persona(), BASELINE);
    expect(row.verdict).toBe("keep");
    expect(r.calls).toBe(3);
    expect(row.trials.length).toBe(3);
    expect(row.envelope).toBe("proposal"); // persona is always proposal
    const db = await pool!.query("SELECT verdict, envelope, tokens_spent FROM lab_experiments");
    expect(db.rows[0].verdict).toBe("keep");
    expect(db.rows[0].envelope).toBe("proposal");
    expect(db.rows[0].tokens_spent).toBe(330); // 3 × (100+10)
    expect(auditRows.length).toBe(1);
  });

  it("guard-band breach on a later trial → discard at that trial", async () => {
    const r = scriptedRunner([
      report({ persona: 90, comprehension: 90, memory: 90, honesty: 90 }),
      report({ persona: 91, comprehension: 86, memory: 90, honesty: 90 }), // comprehension 86 < 90-3
    ]);
    const row = await engine().runExperiment(r, CAMPAIGN, persona(), BASELINE);
    expect(row.verdict).toBe("discard");
    expect(row.verdictReason).toContain("guard band 'comprehension' breached");
    expect(r.calls).toBe(2);
  });

  it("mean improvement below δ → discard even though every trial beat baseline", async () => {
    const r = scriptedRunner([
      report({ persona: 83, comprehension: 90, memory: 90, honesty: 90 }),
      report({ persona: 83, comprehension: 90, memory: 90, honesty: 90 }),
      report({ persona: 82, comprehension: 90, memory: 90, honesty: 90 }),
    ]);
    const row = await engine().runExperiment(r, CAMPAIGN, persona(), BASELINE);
    expect(row.verdict).toBe("discard");
    expect(row.verdictReason).toContain("< δ4");
  });

  it("a crashing bench run → crash verdict, still ledgered", async () => {
    const r = scriptedRunner([report({ persona: 90, comprehension: 90, memory: 90, honesty: 90 })]); // trial 2 throws
    const row = await engine().runExperiment(r, CAMPAIGN, persona(), BASELINE);
    expect(row.verdict).toBe("crash");
    expect(row.verdictReason).toContain("bench crashed");
    const db = await pool!.query("SELECT verdict FROM lab_experiments");
    expect(db.rows[0].verdict).toBe("crash");
  });

  it("out-of-surface candidate: runner NEVER invoked, violation ledgered as discard", async () => {
    const r = scriptedRunner([]);
    const row = await engine().runExperiment(
      r,
      CAMPAIGN,
      { summary: "sneaky", settings: { "budget.lab.nightlyTokenCap": 9e9 } },
      BASELINE,
    );
    expect(row.verdict).toBe("discard");
    expect(row.verdictReason).toContain("out of LAB_SURFACE");
    expect(r.calls).toBe(0);
    const db = await pool!.query("SELECT verdict_reason FROM lab_experiments");
    expect(db.rows[0].verdict_reason).toContain("never touch its own envelope");
  });

  it("history returns newest-first summaries for the researcher", async () => {
    const win = report({ persona: 86, comprehension: 90, memory: 90, honesty: 90 });
    await engine().runExperiment(scriptedRunner([win, win, win]), CAMPAIGN, persona("v1"), BASELINE);
    const h = await engine().history("persona-adherence");
    expect(h.length).toBe(1);
    expect(h[0].verdict).toBe("keep");
  });
});
