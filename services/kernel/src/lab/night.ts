/**
 * Night-Lab orchestrator (D-0079 Slice L3, R-LAB-05/07/08): one campaign
 * night — baseline, then propose→measure→keep/discard experiments until a
 * stop condition, then a morning report GENERATED from the ledger.
 *
 * Halt conditions, re-checked BETWEEN experiments (never mid-bench):
 *   e-stop engaged · lab disabled · quiet hours ended · recent live user
 *   activity · nightly token cap reached · campaign stop conditions ·
 *   researcher can't produce candidates.
 *
 * The lab NEVER applies anything to the live instance here — kept winners
 * carry their envelope and wait for Slice L4's three-envelope application.
 * Default OFF (`lab.enabled`); the e-stop halts it like every other rhythm.
 */

import type pg from "pg";
import {
  LabEngine,
  validateCampaign,
  type BenchReport,
  type BenchRunner,
  type CampaignSpec,
  type ExperimentRow,
} from "./engine.js";
import { generateCandidate } from "./researcher.js";
import type { LabCandidate } from "./surface.js";
import { JUDGE_TEMPLATES } from "../memory/judge.js";

export interface NightSummary {
  skipped?: string;
  halted?: string;
  experiments: number;
  kept: number;
  discarded: number;
  crashed: number;
  tokensSpent: number;
  announced: boolean;
}

interface SettingsLike {
  bool(key: string, dflt: boolean): Promise<boolean>;
  num(key: string, dflt: number): Promise<number>;
  str(key: string, dflt: string): Promise<string>;
}
interface AnnouncerLike {
  raise(input: {
    text: string;
    kind?: "say" | "concern";
    urgency?: "info" | "advisory" | "urgent";
    about?: string;
    recommendation?: string;
    source: string;
    dedupeKey?: string;
  }): Promise<unknown>;
}
interface PromptsLike {
  getActive(kind: "persona" | "system" | "template"): Promise<{ name: string; content: string } | null>;
  get(name: string, kind: "template"): Promise<{ name: string; content: string } | null>;
}
interface GatewayLike {
  chat(req: import("../gateway/schema.js").ChatRequest, signal?: AbortSignal): Promise<import("../gateway/schema.js").ChatResult>;
}

export interface LabNightDeps {
  pool: pg.Pool;
  settings: SettingsLike;
  estop: { readonly isEngaged: boolean };
  audit: { append(e: { actor: string; event: string; payload?: unknown }): Promise<unknown> };
  engine: LabEngine;
  runner: BenchRunner;
  gateway: GatewayLike;
  prompts: PromptsLike;
  announcer?: AnnouncerLike;
  /** load a campaign contract by name (bench/campaigns/<name>.json) */
  loadCampaign: (name: string) => Promise<CampaignSpec | null>;
  lastUserActivity?: () => string | null;
  now?: () => Date;
}

export class LabNightRun {
  private inFlight = false;

  constructor(private readonly deps: LabNightDeps) {}

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private async inQuietHours(): Promise<boolean> {
    const start = await this.deps.settings.num("proactive.quietHours.start", 22);
    const end = await this.deps.settings.num("proactive.quietHours.end", 7);
    const h = this.now().getHours();
    return start <= end ? h >= start && h < end : h >= start || h < end;
  }

  private async userActive(): Promise<boolean> {
    const deferMin = await this.deps.settings.num("heartbeat.deferWhileActiveMinutes", 5);
    const last = this.deps.lastUserActivity?.() ?? null;
    return deferMin > 0 && last !== null && this.now().getTime() - new Date(last).getTime() < deferMin * 60_000;
  }

  /** Rows recorded since the current quiet window opened (one night per window). */
  private async rowsTonight(campaign: string): Promise<number> {
    const start = await this.deps.settings.num("proactive.quietHours.start", 22);
    const windowStart = new Date(this.now());
    windowStart.setMinutes(0, 0, 0);
    windowStart.setHours(start);
    if (windowStart > this.now()) windowStart.setDate(windowStart.getDate() - 1);
    const { rows } = await this.deps.pool.query(
      `SELECT count(*)::int AS n FROM lab_experiments WHERE campaign = $1 AND started_at >= $2`,
      [campaign, windowStart.toISOString()],
    );
    return rows[0].n as number;
  }

  private async currentSurfaceContent(): Promise<{ prompts: { name: string; kind: string; content: string }[] }> {
    const prompts: { name: string; kind: string; content: string }[] = [];
    const persona = await this.deps.prompts.getActive("persona").catch(() => null);
    if (persona) prompts.push({ name: persona.name, kind: "persona", content: persona.content });
    for (const name of Object.keys(JUDGE_TEMPLATES)) {
      const t = await this.deps.prompts.get(name, "template").catch(() => null);
      if (t) prompts.push({ name, kind: "template", content: t.content });
    }
    return { prompts };
  }

  /**
   * Run one campaign night. Never throws; returns an honest summary either way.
   * Skips (with the reason) unless every precondition holds.
   */
  async runNight(): Promise<NightSummary> {
    const none: NightSummary = { experiments: 0, kept: 0, discarded: 0, crashed: 0, tokensSpent: 0, announced: false };
    if (this.inFlight) return { ...none, skipped: "night already in flight" };
    if (this.deps.estop.isEngaged) return { ...none, skipped: "emergency-stop" };
    if (!(await this.deps.settings.bool("lab.enabled", false))) return { ...none, skipped: "disabled" };
    if (!(await this.inQuietHours())) return { ...none, skipped: "outside quiet hours" };
    if (await this.userActive()) return { ...none, skipped: "live session active" };

    const campaignName = await this.deps.settings.str("lab.campaign", "persona-adherence");
    if ((await this.rowsTonight(campaignName)) > 0) return { ...none, skipped: "already ran this quiet window" };

    const spec = await this.deps.loadCampaign(campaignName);
    if (!spec) return { ...none, skipped: `campaign '${campaignName}' not found` };
    const problems = validateCampaign(spec);
    if (problems.length > 0) {
      await this.deps.announcer?.raise({
        kind: "concern", urgency: "advisory", source: "night-lab",
        text: `Night Lab refused campaign '${campaignName}': ${problems.join("; ")}`,
        dedupeKey: `night-lab-bad-campaign-${campaignName}`,
      });
      return { ...none, skipped: "campaign exceeds LAB_SURFACE" };
    }

    this.inFlight = true;
    const summary: NightSummary = { ...none };
    const nightlyCap = await this.deps.settings.num("budget.lab.nightlyTokenCap", 300000);
    try {
      await this.deps.audit.append({ actor: "jarvis-lab", event: "lab_night_started", payload: { campaign: spec.name } });

      // Baseline. A gate failure HERE means the platform itself regressed —
      // that is a wake-the-user finding, not something to experiment on top of.
      let baseline: BenchReport;
      try {
        baseline = await this.deps.runner.run(null);
      } catch (err) {
        summary.halted = `baseline crashed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200);
        await this.deps.announcer?.raise({
          kind: "concern", urgency: "advisory", source: "night-lab",
          text: `Night Lab could not measure a baseline (${summary.halted}). No experiments were run.`,
          dedupeKey: "night-lab-baseline",
        });
        return summary;
      }
      summary.tokensSpent += (baseline.telemetry?.input_tokens ?? 0) + (baseline.telemetry?.output_tokens ?? 0);
      if (!baseline.gates_pass) {
        const failed = baseline.gates.filter((g) => !g.pass).map((g) => g.id).join(",");
        summary.halted = `baseline hard-gate failure: ${failed}`;
        await this.deps.announcer?.raise({
          kind: "concern", urgency: "advisory", source: "night-lab",
          text: `Night Lab baseline failed hard gates (${failed}) — the platform itself needs attention; no experiments were run.`,
          dedupeKey: "night-lab-baseline",
        });
        return summary;
      }

      const maxExperiments = Math.min(spec.stop?.maxExperiments ?? 12, 20);
      const dimBelow = spec.stop?.diminishingReturnsBelow ?? 0;
      const dimCount = spec.stop?.diminishingReturnsCount ?? 2;
      let smallKeeps = 0;
      let nullCandidates = 0;
      const kept: ExperimentRow[] = [];

      for (let i = 0; i < maxExperiments; i++) {
        // ---- halt checks between experiments (R-LAB-05)
        if (this.deps.estop.isEngaged) { summary.halted = "emergency-stop"; break; }
        if (!(await this.deps.settings.bool("lab.enabled", false))) { summary.halted = "disabled mid-night"; break; }
        if (!(await this.inQuietHours())) { summary.halted = "quiet hours ended"; break; }
        if (await this.userActive()) { summary.halted = "live session became active"; break; }
        if (summary.tokensSpent >= nightlyCap) { summary.halted = `nightly token cap (${summary.tokensSpent}/${nightlyCap})`; break; }

        const candidate: LabCandidate | null = await generateCandidate(
          this.deps.gateway, spec, await this.deps.engine.history(spec.name, 12), await this.currentSurfaceContent(),
        );
        if (!candidate) {
          nullCandidates++;
          if (nullCandidates >= 2) { summary.halted = "researcher produced no candidates twice"; break; }
          continue;
        }
        nullCandidates = 0;

        const row = await this.deps.engine.runExperiment(this.deps.runner, spec, candidate, baseline);
        summary.experiments++;
        summary.tokensSpent += row.tokensSpent;
        if (row.verdict === "keep") {
          summary.kept++;
          kept.push(row);
          const mean = row.trials.reduce((a, t) => a + (t.scores[spec.metric] ?? 0), 0) / Math.max(1, row.trials.length);
          const gain = mean - (baseline.scores[spec.metric] ?? 0);
          if (dimBelow > 0 && gain < dimBelow) {
            smallKeeps++;
            if (smallKeeps >= dimCount) { summary.halted = "diminishing returns"; break; }
          } else smallKeeps = 0;
        } else if (row.verdict === "crash") summary.crashed++;
        else summary.discarded++;
      }

      // ---- morning report (R-LAB-07): generated from the ledger, failures and
      // spend included. Raised as a normal announcement: quiet-hours deferral
      // holds it and the D-0077 chat path relays it on the first morning turn.
      const report = await this.morningReport(spec, baseline, summary);
      if (this.deps.announcer) {
        await this.deps.announcer.raise({
          kind: "say", urgency: "info", source: "night-lab", text: report,
          dedupeKey: `night-lab-report-${this.now().toISOString().slice(0, 10)}`,
        });
        summary.announced = true;
      }
      await this.deps.audit.append({
        actor: "jarvis-lab", event: "lab_night_finished",
        payload: { campaign: spec.name, ...summary, halted: summary.halted ?? "" },
      });
      return summary;
    } finally {
      this.inFlight = false;
    }
  }

  private async morningReport(spec: CampaignSpec, baseline: BenchReport, s: NightSummary): Promise<string> {
    const { rows } = await this.deps.pool.query(
      `SELECT id, candidate_summary, verdict, verdict_reason, envelope FROM lab_experiments
       WHERE campaign = $1 AND started_at > now() - interval '12 hours' ORDER BY started_at ASC`,
      [spec.name],
    );
    const base = baseline.scores[spec.metric];
    const lines: string[] = [
      `Night Lab report — campaign '${spec.name}' (baseline ${spec.metric}: ${base ?? "n/a"}).`,
      `${s.experiments} experiment(s): ${s.kept} kept, ${s.discarded} discarded, ${s.crashed} crashed. ` +
      `~${s.tokensSpent.toLocaleString()} tokens spent.` + (s.halted ? ` Halted early: ${s.halted}.` : ""),
    ];
    for (const r of rows) {
      if (r.verdict === "keep") {
        lines.push(
          r.envelope === "proposal"
            ? `• KEPT (awaiting your approval): ${r.candidate_summary} — ${r.verdict_reason}`
            : `• KEPT: ${r.candidate_summary} — ${r.verdict_reason}`,
        );
      } else if (r.verdict === "crash") {
        lines.push(`• crashed: ${r.candidate_summary || "(candidate)"} — ${r.verdict_reason}`);
      }
    }
    if (s.kept === 0 && s.experiments > 0) lines.push("Nothing beat the baseline tonight — honest result, no changes.");
    lines.push("Every experiment is in the lab ledger; kept changes are revertible from there.");
    return lines.join("\n");
  }
}
