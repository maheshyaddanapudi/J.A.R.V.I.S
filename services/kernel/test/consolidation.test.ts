import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import pg from "pg";
import { DecisionLog, SleepCycle, CONSOLIDATION_KEY } from "../src/core/consolidation.js";
import { ReasoningTuner, AUTOTUNE_KEY, type TunerStore } from "../src/core/reasoning.js";

/**
 * Sleep-cycle consolidation (D-0051): J.A.R.V.I.S. learns from ITS OWN
 * operational record (model_calls audit + reasoning-decision journal).
 * Contract under test: evidence-backed findings; bounded knobs auto-adjust;
 * a USER-set value is never overridden and is explicitly noted; consequential
 * changes are proposals only.
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

function prefStore(): TunerStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      const v = data.get(key);
      return v === undefined ? null : { value: v };
    },
    async remember(input) {
      data.set(input.key, input.value);
      return {};
    },
  };
}

async function seedDecisions(
  p: pg.Pool,
  rows: { requested: string; mode: string; reason: string; role: string; n?: number }[],
) {
  for (const r of rows) {
    for (let i = 0; i < (r.n ?? 1); i++) {
      await p.query(
        `INSERT INTO reasoning_decisions (requested, mode, reason, role) VALUES ($1,$2,$3,$4)`,
        [r.requested, r.mode, r.reason, r.role],
      );
    }
  }
}

describe.skipIf(!pool)("SleepCycle consolidation (D-0051)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE reasoning_decisions");
    await pool!.query("TRUNCATE model_calls");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("journals decisions via DecisionLog and reports them grouped", async () => {
    const log = new DecisionLog(pool!);
    await log.record({ requested: "auto", mode: "fast", reason: "routine", role: "fast_conversation" });
    await log.record({ requested: "auto", mode: "deep", reason: "signals", role: "deep_reasoning" });
    const store = prefStore();
    const report = await new SleepCycle({ pool: pool!, tuner: new ReasoningTuner(store), store }).run();
    expect(report.decisions.reduce((s, d) => s + d.n, 0)).toBe(2);
    // report persisted for later reading
    expect(store.data.has(CONSOLIDATION_KEY)).toBe(true);
  });

  it("lowers the threshold (2→1) when the user repeatedly forces deep — with evidence", async () => {
    await seedDecisions(pool!, [
      { requested: "deep", mode: "deep", reason: "override", role: "deep_reasoning", n: 4 },
      { requested: "auto", mode: "deep", reason: "signals", role: "deep_reasoning", n: 1 },
    ]);
    const store = prefStore();
    const tuner = new ReasoningTuner(store);
    const report = await new SleepCycle({ pool: pool!, tuner, store }).run();
    expect(report.findings.some((f) => f.includes("under-escalation"))).toBe(true);
    expect(report.adjustments.some((a) => a.includes("2→1"))).toBe(true);
    expect((await tuner.autotune()).signalThreshold).toBe(1);
    expect((await tuner.autotune()).source).toBe("jarvis");
  });

  it("NEVER overrides a user-set threshold — it takes note instead", async () => {
    await seedDecisions(pool!, [
      { requested: "deep", mode: "deep", reason: "override", role: "deep_reasoning", n: 5 },
    ]);
    const store = prefStore();
    const tuner = new ReasoningTuner(store);
    await tuner.setThreshold(2, "user", "I prefer conservative escalation");
    const report = await new SleepCycle({ pool: pool!, tuner, store }).run();
    expect((await tuner.autotune()).signalThreshold).toBe(2);
    expect((await tuner.autotune()).source).toBe("user");
    expect(report.adjustments).toEqual([]);
    expect(report.notes.some((n) => n.includes("I won't override it"))).toBe(true);
  });

  it("raises the threshold back (1→2) when the user repeatedly forces fast", async () => {
    await seedDecisions(pool!, [
      { requested: "fast", mode: "fast", reason: "override", role: "fast_conversation", n: 4 },
    ]);
    const store = prefStore();
    const tuner = new ReasoningTuner(store);
    await tuner.setThreshold(1, "jarvis", "prior adjustment");
    const report = await new SleepCycle({ pool: pool!, tuner, store }).run();
    expect(report.adjustments.some((a) => a.includes("1→2"))).toBe(true);
    expect((await tuner.autotune()).signalThreshold).toBe(2);
  });

  it("surfaces provider failures and ineligible-downgrade gaps as findings/proposals — never auto-applied", async () => {
    await seedDecisions(pool!, [
      { requested: "auto", mode: "fast", reason: "downgrade_ineligible", role: "fast_conversation", n: 2 },
    ]);
    for (let i = 0; i < 5; i++) {
      await pool!.query(
        `INSERT INTO model_calls (role, provider, model, privacy_class, source, ok, error, latency_ms)
         VALUES ('fast_conversation','anthropic','claude-sonnet-5','STANDARD','test',$1,$2,10)`,
        [i >= 3, i >= 3 ? null : "no API key"],
      );
    }
    const store = prefStore();
    const report = await new SleepCycle({ pool: pool!, tuner: new ReasoningTuner(store), store }).run();
    expect(report.findings.some((f) => f.includes("calls failed"))).toBe(true);
    expect(report.proposals.some((p) => p.includes("investigate provider 'anthropic'"))).toBe(true);
    expect(report.proposals.some((p) => p.includes("LOCAL deep_reasoning target"))).toBe(true);
    // proposals are never silently applied: threshold untouched
    expect(report.autotune.signalThreshold).toBe(2);
    expect(report.autotune.source).toBe("default");
  });

  it("a quiet window produces a calm report (no findings, no adjustments)", async () => {
    const store = prefStore();
    const report = await new SleepCycle({ pool: pool!, tuner: new ReasoningTuner(store), store }).run();
    expect(report.findings).toEqual([]);
    expect(report.adjustments).toEqual([]);
    expect(report.proposals).toEqual([]);
  });
});

describe("ReasoningTuner autotune bounds", () => {
  it("user set → jarvis refused; user re-set → applied; corrupt store → default", async () => {
    const store = prefStore();
    const tuner = new ReasoningTuner(store);
    expect((await tuner.autotune()).signalThreshold).toBe(2);
    await tuner.setThreshold(1, "user", "eager please");
    const refused = await tuner.setThreshold(2, "jarvis", "sleep-cycle");
    expect(refused.applied).toBe(false);
    expect((await tuner.autotune()).signalThreshold).toBe(1);
    const applied = await tuner.setThreshold(2, "user", "changed my mind");
    expect(applied.applied).toBe(true);
    store.data.set(AUTOTUNE_KEY, '{"signalThreshold":99,"source":"jarvis"}');
    expect((await tuner.autotune()).signalThreshold).toBe(2);
    const noop = vi.fn();
    void noop;
  });
});
