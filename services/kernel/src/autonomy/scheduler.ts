import type { ActivityBus } from "../core/activity.js";
import type { AuditLog } from "../core/audit.js";
import type { EmergencyStop } from "../core/estop.js";
import type { SettingsRegistry } from "../settings/registry.js";
import type pg from "pg";
import type { AgentRuntime } from "../agent/contract.js";
import type { Agenda } from "./agenda.js";
import type { ProactivityEngine } from "../proactive/engine.js";
import type { SleepCycle } from "../core/consolidation.js";

/**
 * Background autonomy (D-0024, approved 2026-07-18) — the "runs on its own"
 * layer a real J.A.R.V.I.S. needs. It is deliberately BOUNDED to the two cycles
 * that are already safe to run unattended:
 *   • proactivity  — computes + SURFACES suggestions (no consequential action;
 *     R-PRO: it never acts, only offers, and each item carries its "why")
 *   • sleep-cycle  — bounded self-calibration + PROPOSALS (D-0051/52; only the
 *     escalation threshold auto-adjusts, everything consequential is proposed)
 *
 * Safety envelope (unchanged by autonomy):
 *   - it triggers only these two non-consequential cycles; it never
 *     auto-executes a CONSEQUENTIAL/HIGH_RISK tool — those still require
 *     approval through the normal gated loop;
 *   - the emergency stop halts it (a tick is skipped while engaged);
 *   - every tick is audited + emitted to the activity timeline;
 *   - config is persisted + runtime-editable (D-0058 settings), default OFF —
 *     approved does not mean silently self-starting; one toggle turns it on and
 *     the choice persists.
 * Real push notifications to a device are NEEDS-MAC; here the scheduler surfaces
 * into the timeline + proactive items the Command Center already shows.
 */
export interface TickResult {
  proactiveSurfaced: number;
  consolidated: boolean;
  /** heartbeat pass (D-0064): agenda items reviewed / completed, brain used */
  agendaReviewed?: number;
  agendaCompleted?: number;
  brainUsed?: boolean;
  skipped?: string;
}

export interface AutonomyStatus {
  enabled: boolean;
  intervalMinutes: number;
  running: boolean;
  lastTickAt: string | null;
  lastResult: TickResult | null;
}

export class BackgroundScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentIntervalMs = 0;
  private lastTickAt: string | null = null;
  private lastResult: TickResult | null = null;
  private ticking = false;

  constructor(
    private readonly deps: {
      settings: SettingsRegistry;
      proactive: ProactivityEngine;
      sleepCycle: SleepCycle;
      estop: EmergencyStop;
      audit: AuditLog;
      activity: ActivityBus;
      /** the living heartbeat (D-0064): J.A.R.V.I.S.'s own agenda + bounded brain pass */
      agenda?: Agenda;
      agent?: AgentRuntime;
      pool?: pg.Pool;
      /** last USER-driven activity (heartbeat excluded) — for defer-while-active */
      lastUserActivity?: () => string | null;
      /** spend governance (D-0066): autonomy pauses when its token cap is hit */
      budget?: import("../core/budget.js").Budget;
      /** injectable clock for tests (defaults to real time) */
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  async status(): Promise<AutonomyStatus> {
    return {
      enabled: await this.deps.settings.bool("autonomy.enabled", false),
      intervalMinutes: await this.deps.settings.num("autonomy.intervalMinutes", 30),
      running: this.timer !== null,
      lastTickAt: this.lastTickAt,
      lastResult: this.lastResult,
    };
  }

  /**
   * One autonomous tick. Safe to call directly (tests) or from the timer.
   * Returns a summary; never throws (autonomy must not crash the kernel).
   */
  async tick(): Promise<TickResult> {
    if (this.ticking) return { proactiveSurfaced: 0, consolidated: false, skipped: "overlap" };
    this.ticking = true;
    const at = this.now().toISOString();
    this.lastTickAt = at;
    try {
      if (this.deps.estop.isEngaged) {
        this.lastResult = { proactiveSurfaced: 0, consolidated: false, skipped: "emergency-stop" };
        return this.lastResult;
      }
      const s = this.deps.settings;
      if (!(await s.bool("autonomy.enabled", false))) {
        this.lastResult = { proactiveSurfaced: 0, consolidated: false, skipped: "disabled" };
        return this.lastResult;
      }
      // Spend governance (D-0066): if autonomy has spent its cap, this whole
      // tick's WORK is skipped (journaled) — but a beat still records that it
      // was alive and why it held back. Live conversation is unaffected.
      let budgetBlock: string | undefined;
      if (this.deps.budget) {
        try {
          const b = await this.deps.budget.allowAutonomy();
          if (!b.allowed) budgetBlock = b.reason;
        } catch { /* metering glitch must not freeze autonomy */ }
      }
      let proactiveSurfaced = 0;
      let consolidated = false;
      if (!budgetBlock && await s.bool("autonomy.runProactive", true)) {
        try {
          const r = await this.deps.proactive.run(this.now());
          proactiveSurfaced = r.surfaced.length;
        } catch { /* a cycle failure must not stop the loop */ }
      }
      if (!budgetBlock && await s.bool("autonomy.runSleepCycle", true)) {
        // THREE-RHYTHM SEPARATION: sleep (deep consolidation) is a QUIET-HOURS
        // activity, distinct from the frequent heartbeat. When opted in, it runs
        // only inside the household quiet-hours window; heartbeats outside the
        // window stay light. (On-demand POST /core/reasoning/consolidate always works.)
        let inWindow = true;
        if (await s.bool("sleep.useQuietHours", false)) {
          const start = await s.num("proactive.quietHours.start", 22);
          const end = await s.num("proactive.quietHours.end", 7);
          const h = this.now().getHours();
          inWindow = start <= end ? h >= start && h < end : h >= start || h < end;
        }
        if (inWindow) {
          try {
            await this.deps.sleepCycle.run(24);
            consolidated = true;
          } catch { /* best-effort */ }
        }
      }
      // ---- The living heartbeat (D-0064): review J.A.R.V.I.S.'s OWN agenda and
      // let it think + act within the safety ceiling. Autonomous COGNITION,
      // gated ACTION: steps ≤ LOW_REVERSIBLE auto-run; anything consequential is
      // auto-DENIED (the model queues it back on the agenda for the user).
      let agendaReviewed = 0;
      let agendaCompleted = 0;
      let brainUsed = false;
      let beatSummary = "";
      let beatDetail = "";
      if (!budgetBlock && this.deps.agenda) {
        try {
          const due = await this.deps.agenda.due(this.now());
          agendaReviewed = due.length;
          const brainMode = await s.str("heartbeat.brain", "when-agenda");
          // NO-COLLIDE with a live session: if the user interacted moments ago,
          // this beat stays quiet (agenda holds; the next beat picks it up).
          const deferMin = await s.num("heartbeat.deferWhileActiveMinutes", 5);
          const lastActive = this.deps.lastUserActivity?.() ?? null;
          const userActive =
            deferMin > 0 && lastActive !== null &&
            this.now().getTime() - new Date(lastActive).getTime() < deferMin * 60_000;
          if (userActive) beatSummary = "deferred — live session active";
          const shouldThink =
            !userActive &&
            !!this.deps.agent && brainMode !== "off" && (brainMode === "every-tick" || due.length > 0);
          if (shouldThink) {
            const maxSteps = await s.num("heartbeat.maxSteps", 6);
            const privacy = (await s.str("heartbeat.privacy", "LOCAL_ONLY")) as "LOCAL_ONLY" | "STANDARD";
            const list = due.map((d) => `- (id ${d.id}) ${d.what}${d.why ? ` — ${d.why}` : ""}`).join("\n");
            const objective =
              `HEARTBEAT (nobody is talking to you; this is your own time). Your pending agenda:\n` +
              (list || "- (empty — reflect briefly)") +
              `\n\nWork the agenda: do what is safe now with your tools and mark items agenda.complete with the outcome. ` +
              `Anything needing user approval WILL BE DENIED at this hour — do not force it; leave it pending or agenda.add a refined version for the user. ` +
              `If you notice something worth doing later, agenda.add it (that is you planning your own next heartbeat). ` +
              `Finish with ONE sentence summarising this heartbeat.`;
            const r = await this.deps.agent!.run(objective, {
              maxSteps: Math.max(2, Math.min(12, maxSteps)),
              privacyClass: privacy,
              source: "heartbeat",
              approvalCeiling: "LOW_REVERSIBLE",
            });
            brainUsed = true;
            beatSummary = (r.answer ?? "").slice(0, 300);
            beatDetail = r.steps
              .map((st) => `${st.tool}: ${st.ok ? "ok" : "DENIED/failed"} — ${String(st.summary ?? "").slice(0, 120)}`)
              .join("\n")
              .slice(0, 4000);
            agendaCompleted = r.steps.filter((st) => st.tool === "agenda.complete" && st.ok).length;
          }
        } catch { /* the heartbeat must never crash the tick */ }
      }
      // journal the beat (persisted — the observable "I was alive at ...")
      if (this.deps.pool) {
        try {
          await this.deps.pool.query(
            `INSERT INTO heartbeats (at, proactive_surfaced, consolidated, agenda_reviewed, agenda_completed, brain_used, summary, detail)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [at, proactiveSurfaced, consolidated, agendaReviewed, agendaCompleted, brainUsed, beatSummary, beatDetail],
          );
        } catch { /* journal is best-effort */ }
      }
      if (budgetBlock && !beatSummary) beatSummary = `held back — ${budgetBlock}`;
      this.lastResult = { proactiveSurfaced, consolidated, agendaReviewed, agendaCompleted, brainUsed };
      this.deps.activity.emit({
        kind: "decision",
        summary: `heartbeat: ${proactiveSurfaced} proactive${consolidated ? ", consolidated" : ""}, agenda ${agendaCompleted}/${agendaReviewed}${brainUsed ? " (thought)" : ""}${beatSummary ? ` — ${beatSummary.slice(0, 120)}` : ""}`,
        at,
      });
      await this.deps.audit.append({
        actor: "kernel",
        event: "autonomy_tick",
        payload: { at, proactiveSurfaced, consolidated, agendaReviewed, agendaCompleted, brainUsed },
      });
      return this.lastResult;
    } catch (err) {
      this.lastResult = { proactiveSurfaced: 0, consolidated: false, skipped: `error: ${err instanceof Error ? err.message : String(err)}` };
      return this.lastResult;
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Reconcile the timer with the current settings. Called at startup and
   * whenever autonomy settings change (a setting write triggers this). Idempotent.
   */
  async reconcile(): Promise<void> {
    const enabled = await this.deps.settings.bool("autonomy.enabled", false);
    const minutes = Math.max(1, await this.deps.settings.num("autonomy.intervalMinutes", 30));
    const wantMs = minutes * 60_000;
    if (!enabled) {
      if (this.timer) { clearInterval(this.timer); this.timer = null; this.currentIntervalMs = 0; }
      return;
    }
    if (this.timer && this.currentIntervalMs === wantMs) return; // already correct
    if (this.timer) clearInterval(this.timer);
    this.currentIntervalMs = wantMs;
    this.timer = setInterval(() => { void this.tick(); }, wantMs);
    // Node: don't keep the process alive solely for this timer.
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
