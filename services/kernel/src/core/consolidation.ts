import type pg from "pg";
import type { EpisodicMemory } from "../memory/episodes.js";
import {
  type Autotune,
  type DepthReason,
  type ReasoningMode,
  ReasoningTuner,
} from "./reasoning.js";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Sleep-cycle consolidation (D-0051): like a human reviewing the day before
 * sleep, J.A.R.V.I.S. periodically reads ITS OWN operational record — the
 * model_calls audit (R-MODEL-03) and the reasoning-decision journal (0015) —
 * and adjusts for tomorrow. Three honesty rules bind it:
 *   1. Everything it concludes carries evidence (counts from real records).
 *   2. It may AUTO-APPLY only bounded, local, reversible knobs (today: the
 *      escalation signal threshold, 1↔2). A USER-set value is respected by
 *      default and revisited only when contradicting evidence SINCE the pin
 *      clears a higher, re-pin-scaled bar (D-0052) — either way it says so.
 *   3. Anything consequential (role targets, effort levels, provider order)
 *      is a PROPOSAL for the user, never applied silently.
 * Scheduling: run on demand (`POST /core/reasoning/consolidate`) or from a
 * skill/agent; unattended nightly runs arrive with the D-0024 background gate.
 */

export interface ConsolidationReport {
  at: string;
  windowHours: number;
  decisions: { requested: string; mode: ReasoningMode; reason: DepthReason; n: number }[];
  calls: {
    role: string;
    provider: string | null;
    model: string | null;
    n: number;
    failures: number;
    fallbacks: number;
    avgLatencyMs: number;
  }[];
  /** what the record shows, each with its evidence */
  findings: string[];
  /** consequential changes suggested to the user — never auto-applied */
  proposals: string[];
  /** bounded knobs actually adjusted this run (with why) */
  adjustments: string[];
  /** respected constraints, e.g. a standing user override */
  notes: string[];
  autotune: Autotune;
}

export const CONSOLIDATION_KEY = "reasoning_last_consolidation";

/** Best-effort journal writer for the loop (categorical only — no content). */
export class DecisionLog {
  constructor(private readonly pool: pg.Pool) {}

  async record(d: {
    requested: "auto" | "deep" | "fast";
    mode: ReasoningMode;
    reason: DepthReason;
    role: string;
  }): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO reasoning_decisions (requested, mode, reason, role) VALUES ($1,$2,$3,$4)`,
        [d.requested, d.mode, d.reason, d.role],
      );
    } catch {
      /* journaling must never break a conversation */
    }
  }
}

export class SleepCycle {
  constructor(
    private readonly deps: {
      pool: pg.Pool;
      tuner: ReasoningTuner;
      /** consolidations land on the timeline so "what did you learn?" works */
      episodes?: EpisodicMemory;
      /** report persistence (any TunerStore-compatible preference store) */
      store: { remember(i: { key: string; value: string; provenance: string }): Promise<unknown> };
    },
  ) {}

  async run(windowHours = 24): Promise<ConsolidationReport> {
    const { pool, tuner } = this.deps;

    const decisions = (
      await pool.query<{ requested: string; mode: ReasoningMode; reason: DepthReason; n: string }>(
        `SELECT requested, mode, reason, count(*) n FROM reasoning_decisions
          WHERE at > now() - ($1 || ' hours')::interval
          GROUP BY requested, mode, reason ORDER BY n DESC`,
        [windowHours],
      )
    ).rows.map((r) => ({ ...r, n: Number(r.n) }));

    const calls = (
      await pool.query<{
        role: string; provider: string | null; model: string | null;
        n: string; failures: string; fallbacks: string; avg_ms: string | null;
      }>(
        `SELECT role, provider, model, count(*) n,
                count(*) FILTER (WHERE NOT ok) failures,
                count(*) FILTER (WHERE fallback_from <> '{}') fallbacks,
                avg(latency_ms) avg_ms
           FROM model_calls
          WHERE at > now() - ($1 || ' hours')::interval
          GROUP BY role, provider, model ORDER BY n DESC`,
        [windowHours],
      )
    ).rows.map((r) => ({
      role: r.role, provider: r.provider, model: r.model,
      n: Number(r.n), failures: Number(r.failures), fallbacks: Number(r.fallbacks),
      avgLatencyMs: Math.round(Number(r.avg_ms ?? 0)),
    }));

    const findings: string[] = [];
    const proposals: string[] = [];
    const adjustments: string[] = [];
    const notes: string[] = [];

    const count = (f: (d: (typeof decisions)[number]) => boolean) =>
      decisions.filter(f).reduce((s, d) => s + d.n, 0);

    // --- escalation calibration: compare my auto choices with your overrides ---
    const overrodeToDeep = count((d) => d.reason === "override" && d.mode === "deep")
      + count((d) => d.reason === "correction_promoted");
    const overrodeToFast = count((d) => d.reason === "override" && d.mode === "fast");
    const autoDeep = count(
      (d) => d.requested === "auto" && d.mode === "deep" && d.reason !== "downgrade_ineligible",
    );
    const tune = await tuner.autotune();

    if (tune.source === "user") {
      // D-0052: a user pin is respected by default, but it is not permanent
      // law — count contradicting evidence accumulated SINCE the pin; the bar
      // is higher than for my own values and rises with every user re-pin.
      // Whatever I decide, I say so.
      const needed = 6 * ((tune.repins ?? 0) + 1);
      const sincePin = async (mode: "deep" | "fast"): Promise<number> => {
        const { rows } = await pool.query<{ n: string }>(
          `SELECT count(*) n FROM reasoning_decisions
            WHERE at > COALESCE($1::timestamptz, now() - ($2 || ' hours')::interval)
              AND ((reason = 'override' AND mode = $3) OR ($3 = 'deep' AND reason = 'correction_promoted'))`,
          [tune.at ?? null, windowHours, mode],
        );
        return Number(rows[0]!.n);
      };
      const wantDeep = tune.signalThreshold === 2 ? await sincePin("deep") : 0;
      const wantFast = tune.signalThreshold === 1 ? await sincePin("fast") : 0;
      const contradictions = Math.max(wantDeep, wantFast);
      const target: 1 | 2 = tune.signalThreshold === 2 ? 1 : 2;
      if (contradictions >= needed) {
        findings.push(
          `your manual threshold (${tune.signalThreshold}${tune.reason ? `, "${tune.reason}"` : ""}) has been contradicted ${contradictions}× since you set it (bar: ${needed})`,
        );
        const res = await tuner.setThreshold(target, "jarvis",
          `sleep-cycle: ${contradictions} contradictions since your setting of ${tune.at ?? "unknown"} cleared the bar of ${needed}`,
          { overrideUser: true });
        if (res.applied) {
          adjustments.push(
            `changed your manual setting ${tune.signalThreshold}→${target} — the trail outweighed the pin (${contradictions} ≥ ${needed}); re-set it and I'll hold it twice as long`,
          );
        }
      } else if (contradictions > 0) {
        notes.push(
          `your manual threshold (${tune.signalThreshold}${tune.reason ? `, "${tune.reason}"` : ""}) stands — ${contradictions} contradiction(s) since you set it; I'd revisit at ${needed}`,
        );
      } else {
        notes.push(
          `threshold ${tune.signalThreshold} is your manual setting${tune.reason ? ` ("${tune.reason}")` : ""} — respected, no contradicting evidence since`,
        );
      }
    } else if (overrodeToDeep >= 3 && overrodeToDeep > autoDeep) {
      findings.push(
        `under-escalation: you forced deep ${overrodeToDeep}× while I chose it ${autoDeep}× on my own`,
      );
      if (tune.signalThreshold === 2) {
        const res = await tuner.setThreshold(1, "jarvis",
          `sleep-cycle: user forced deep ${overrodeToDeep}× vs ${autoDeep} auto escalations in ${windowHours}h`);
        if (res.applied) {
          adjustments.push("lowered auto-escalation threshold 2→1 (one strong signal now escalates)");
        }
      }
    } else if (overrodeToFast >= 3 && overrodeToFast > autoDeep) {
      findings.push(`over-escalation: you forced fast ${overrodeToFast}× against my deep choices`);
      if (tune.signalThreshold === 1) {
        const res = await tuner.setThreshold(2, "jarvis",
          `sleep-cycle: user forced fast ${overrodeToFast}× in ${windowHours}h`);
        if (res.applied) adjustments.push("raised auto-escalation threshold 1→2 (conservative again)");
      }
    }

    const downgrades = count((d) => d.reason === "downgrade_ineligible");
    if (downgrades > 0) {
      findings.push(`${downgrades} deep turn(s) downgraded — no eligible deep_reasoning provider at the time`);
      proposals.push(
        "configure a LOCAL deep_reasoning target (e.g. ollama/gpt-oss:120b@high+thinking) so deep thinking also works offline/LOCAL_ONLY",
      );
    }

    // --- provider health from the call audit ---
    for (const c of calls) {
      if (c.n >= 4 && c.failures / c.n > 0.25) {
        findings.push(
          `${c.role} via ${c.provider}/${c.model}: ${c.failures}/${c.n} calls failed`,
        );
        proposals.push(
          `investigate provider '${c.provider}' for role ${c.role} (reorder targets or fix the endpoint/key)`,
        );
      }
      if (c.fallbacks > 0) {
        findings.push(`${c.role}: ${c.fallbacks} call(s) needed a fallback away from ${c.provider}/${c.model}`);
      }
      if (c.role === "deep_reasoning" && c.n >= 3 && c.avgLatencyMs > 20000) {
        findings.push(`deep_reasoning averages ${Math.round(c.avgLatencyMs / 1000)}s via ${c.provider}/${c.model}`);
        proposals.push(
          `consider effort 'high' instead of 'xhigh' for conversational deep turns on ${c.provider}/${c.model} (keep xhigh for agent/planning work)`,
        );
      }
    }

    const atRow = await pool.query<{ now: string }>("SELECT now()::text AS now");
    const report: ConsolidationReport = {
      at: atRow.rows[0]!.now,
      windowHours,
      decisions,
      calls,
      findings,
      proposals,
      adjustments,
      notes,
      autotune: await tuner.autotune(),
    };

    // Persist for GET + land on the timeline (both best-effort).
    try {
      await this.deps.store.remember({
        key: CONSOLIDATION_KEY,
        value: JSON.stringify(report),
        provenance: "sleep-cycle",
      });
    } catch { /* report still returned */ }
    try {
      await this.deps.episodes?.record({
        summary: `Sleep-cycle consolidation: ${findings.length} finding(s), ${adjustments.length} adjustment(s), ${proposals.length} proposal(s)`,
        detail: [...findings, ...adjustments.map((a) => `adjusted: ${a}`), ...proposals.map((p) => `proposed: ${p}`)].join("\n") || "quiet period — nothing to adjust",
        kind: "decision",
        importance: adjustments.length || proposals.length ? 0.6 : 0.3,
        tags: ["sleep-cycle", "reasoning"],
        provenance: "sleep-cycle",
      });
    } catch { /* timeline is best-effort */ }

    return report;
  }
}
