import type { ActivityBus } from "../core/activity.js";
import type { AuditLog } from "../core/audit.js";
import type { EmergencyStop } from "../core/estop.js";
import type { SettingsRegistry } from "../settings/registry.js";
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
      let proactiveSurfaced = 0;
      let consolidated = false;
      if (await s.bool("autonomy.runProactive", true)) {
        try {
          const r = await this.deps.proactive.run(this.now());
          proactiveSurfaced = r.surfaced.length;
        } catch { /* a cycle failure must not stop the loop */ }
      }
      if (await s.bool("autonomy.runSleepCycle", true)) {
        try {
          await this.deps.sleepCycle.run(24);
          consolidated = true;
        } catch { /* best-effort */ }
      }
      this.lastResult = { proactiveSurfaced, consolidated };
      this.deps.activity.emit({
        kind: "decision",
        summary: `autonomy tick: ${proactiveSurfaced} proactive surfaced${consolidated ? ", consolidated" : ""}`,
        at,
      });
      await this.deps.audit.append({
        actor: "kernel",
        event: "autonomy_tick",
        payload: { at, proactiveSurfaced, consolidated },
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
