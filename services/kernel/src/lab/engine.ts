/**
 * Night-Lab experiment engine (D-0079 Slice L2, R-LAB-03/04/09).
 *
 * One experiment = propose ONE candidate change on the LAB_SURFACE, measure it
 * on the isolated lab instance via the bench, keep/discard on the evidence:
 *
 *   trial 1: gates must pass (any failure = automatic discard, R-LAB-03) and
 *            the campaign metric must beat baseline at all;
 *   trials 2..N: re-bench; guard bands must hold on EVERY trial; keep only if
 *            mean improvement ≥ δ (no single noisy win is ever kept, R-LAB-09).
 *
 * Every experiment — kept, discarded, crashed — lands in lab_experiments and
 * on the episodic timeline (R-LAB-04). The engine itself NEVER applies
 * anything to the live instance; that is Slice L4's three-envelope path.
 */

import type { Pool } from "pg";
import { validateCandidate, type LabCandidate, LAB_SETTINGS_SURFACE, LAB_PROMPT_SURFACE } from "./surface.js";

export interface BenchScores {
  [dimension: string]: number;
}

export interface BenchGate {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
}

export interface BenchReport {
  gates_pass: boolean;
  gates: BenchGate[];
  scores: BenchScores;
  bench_hash: string;
  telemetry?: { model_calls?: number; input_tokens?: number; output_tokens?: number };
}

/** Runs the bench once (candidate = null → baseline). Injectable for tests;
 *  the real implementation shells out to scripts/lab_bench.py (bench.ts). */
export interface BenchRunner {
  run(candidate: LabCandidate | null): Promise<BenchReport>;
}

export interface CampaignSpec {
  name: string;
  metric: string;
  guardBands: string[];
  surface: { prompts?: { name?: string; kind: "template" | "persona" }[]; settings?: string[] };
  hypotheses: string[];
  stop?: { maxExperiments?: number; diminishingReturnsBelow?: number; diminishingReturnsCount?: number };
}

export interface ExperimentRow {
  id: string;
  campaign: string;
  candidate: LabCandidate;
  candidateSummary: string;
  hypothesis: string;
  baseline: BenchScores;
  trials: { scores: BenchScores; gatesPass: boolean }[];
  verdict: "keep" | "discard" | "crash";
  verdictReason: string;
  gateFailures: BenchGate[];
  tokensSpent: number;
  benchHash: string;
  envelope: "auto" | "proposal";
}

interface AuditLike {
  append(e: { actor: string; event: string; payload?: unknown }): Promise<unknown>;
}
interface EpisodesLike {
  record(input: { summary: string; kind?: string; detail?: string; tags?: string[]; provenance: string }): Promise<unknown>;
}

export interface LabEngineOpts {
  /** total bench trials a would-be keep must survive (default 3, R-LAB-09) */
  trials?: number;
  /** required mean improvement of the campaign metric (default 4 points) */
  delta?: number;
  /** max tolerated drop on any guard-band dimension, any trial (default 3) */
  epsilon?: number;
}

/** A campaign may only narrow LAB_SURFACE, never exceed it. */
export function validateCampaign(spec: CampaignSpec): string[] {
  const problems: string[] = [];
  if (!spec.name || !spec.metric) problems.push("campaign needs name + metric");
  for (const p of spec.surface.prompts ?? []) {
    if (p.kind === "persona") continue; // in-surface by kind (proposal envelope)
    if (!p.name || !LAB_PROMPT_SURFACE.some((s) => s.kind === p.kind && s.name === p.name)) {
      problems.push(`campaign prompt surface '${p.name ?? "?"}' (${p.kind}) exceeds LAB_SURFACE`);
    }
  }
  for (const key of spec.surface.settings ?? []) {
    if (!LAB_SETTINGS_SURFACE.includes(key)) problems.push(`campaign setting surface '${key}' exceeds LAB_SURFACE`);
  }
  return problems;
}

export class LabEngine {
  private readonly trialsN: number;
  private readonly delta: number;
  private readonly epsilon: number;

  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditLike,
    private readonly episodes: EpisodesLike | null,
    opts: LabEngineOpts = {},
  ) {
    this.trialsN = Math.max(2, opts.trials ?? 3);
    this.delta = opts.delta ?? 4;
    this.epsilon = opts.epsilon ?? 3;
  }

  /** Guard bands must hold on EVERY trial (spec §5.2). */
  private guardBreach(spec: CampaignSpec, baseline: BenchScores, scores: BenchScores): string | null {
    for (const dim of spec.guardBands) {
      const base = baseline[dim];
      const got = scores[dim];
      if (base === undefined || got === undefined) continue;
      if (got < base - this.epsilon) return `guard band '${dim}' breached: ${got} < ${base} - ε${this.epsilon}`;
    }
    return null;
  }

  /**
   * Run one full experiment against an already-measured baseline. Never
   * throws: a crashed bench run records a `crash` verdict and returns.
   */
  async runExperiment(
    runner: BenchRunner,
    spec: CampaignSpec,
    candidate: LabCandidate,
    baseline: BenchReport,
  ): Promise<ExperimentRow> {
    const surface = validateCandidate(candidate);
    const row: ExperimentRow = {
      id: "",
      campaign: spec.name,
      candidate,
      candidateSummary: candidate.summary ?? "",
      hypothesis: candidate.hypothesis ?? "",
      baseline: baseline.scores,
      trials: [],
      verdict: "discard",
      verdictReason: "",
      gateFailures: [],
      tokensSpent: 0,
      benchHash: baseline.bench_hash,
      envelope: surface.envelope,
    };
    if (!surface.ok) {
      // Structurally out of surface — recorded as a discard with the violation,
      // never silently dropped (the ledger must show what was attempted).
      row.verdict = "discard";
      row.verdictReason = `out of LAB_SURFACE: ${surface.violations.join("; ")}`;
      return this.persist(row);
    }
    try {
      const metricVals: number[] = [];
      for (let t = 0; t < this.trialsN; t++) {
        const report = await runner.run(candidate);
        row.tokensSpent += (report.telemetry?.input_tokens ?? 0) + (report.telemetry?.output_tokens ?? 0);
        row.benchHash = report.bench_hash || row.benchHash;
        row.trials.push({ scores: report.scores, gatesPass: report.gates_pass });
        if (!report.gates_pass) {
          row.verdict = "discard";
          row.gateFailures = report.gates.filter((g) => !g.pass);
          row.verdictReason = `hard gate failure (trial ${t + 1}): ${row.gateFailures.map((g) => g.id).join(",")}`;
          return this.persist(row);
        }
        const breach = this.guardBreach(spec, baseline.scores, report.scores);
        if (breach) {
          row.verdict = "discard";
          row.verdictReason = `${breach} (trial ${t + 1})`;
          return this.persist(row);
        }
        const m = report.scores[spec.metric];
        if (m === undefined) {
          row.verdict = "discard";
          row.verdictReason = `bench produced no '${spec.metric}' score (trial ${t + 1})`;
          return this.persist(row);
        }
        metricVals.push(m);
        // First trial must beat baseline AT ALL before we pay for more trials.
        if (t === 0 && m <= (baseline.scores[spec.metric] ?? 0)) {
          row.verdict = "discard";
          row.verdictReason = `no improvement on first trial: ${m} ≤ baseline ${baseline.scores[spec.metric]}`;
          return this.persist(row);
        }
      }
      const mean = metricVals.reduce((a, b) => a + b, 0) / metricVals.length;
      const base = baseline.scores[spec.metric] ?? 0;
      if (mean - base >= this.delta) {
        row.verdict = "keep";
        row.verdictReason = `mean ${spec.metric} ${mean.toFixed(1)} ≥ baseline ${base} + δ${this.delta} over ${this.trialsN} trials`;
      } else {
        row.verdict = "discard";
        row.verdictReason = `mean ${spec.metric} ${mean.toFixed(1)} improvement < δ${this.delta} vs baseline ${base}`;
      }
      return this.persist(row);
    } catch (err) {
      row.verdict = "crash";
      row.verdictReason = `bench crashed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 400);
      return this.persist(row);
    }
  }

  private async persist(row: ExperimentRow): Promise<ExperimentRow> {
    const { rows } = await this.pool.query(
      `INSERT INTO lab_experiments
         (campaign, finished_at, candidate, candidate_summary, hypothesis, baseline, trials,
          verdict, verdict_reason, gate_failures, tokens_spent, bench_hash, envelope)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        row.campaign,
        JSON.stringify(row.candidate),
        row.candidateSummary,
        row.hypothesis,
        JSON.stringify(row.baseline),
        JSON.stringify(row.trials),
        row.verdict,
        row.verdictReason,
        JSON.stringify(row.gateFailures),
        row.tokensSpent,
        row.benchHash,
        row.envelope,
      ],
    );
    row.id = rows[0].id as string;
    await this.audit.append({
      actor: "jarvis-lab",
      event: "lab_experiment",
      payload: {
        id: row.id,
        campaign: row.campaign,
        verdict: row.verdict,
        summary: row.candidateSummary,
        tokens: row.tokensSpent,
      },
    });
    // Episodic trail (best-effort): future beats/consolidations reason over
    // lab history like any other experience.
    try {
      await this.episodes?.record({
        summary: `Night Lab [${row.campaign}] ${row.verdict}: ${row.candidateSummary || row.verdictReason}`,
        kind: "action",
        detail: row.verdictReason,
        tags: ["night-lab", row.campaign],
        provenance: "night-lab experiment engine (D-0079)",
      });
    } catch {
      /* the ledger row is the durable record */
    }
    return row;
  }

  async history(campaign: string, limit = 20): Promise<{ summary: string; verdict: string; reason: string }[]> {
    const { rows } = await this.pool.query(
      `SELECT candidate_summary, verdict, verdict_reason FROM lab_experiments
       WHERE campaign = $1 ORDER BY started_at DESC LIMIT $2`,
      [campaign, limit],
    );
    return rows.map((r) => ({
      summary: r.candidate_summary as string,
      verdict: r.verdict as string,
      reason: r.verdict_reason as string,
    }));
  }
}
