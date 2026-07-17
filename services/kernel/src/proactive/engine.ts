import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { ActivityBus } from "../core/activity.js";
import { GateStack } from "./gates.js";
import {
  briefingCandidate,
  calendarConflictCandidates,
  commitmentCandidates,
} from "./generators.js";
import type { Candidate, GateConfig, ProactiveItem, Suppression } from "./types.js";
import type { ProactiveRules } from "./rules.js";

/**
 * Proactivity engine (R-PRO-01…03). Generates candidates from real data, runs
 * them through the gate stack, records survivors, and emits them to the activity
 * timeline. It surfaces INFORMATION and SUGGESTIONS only — it never performs a
 * consequential action; anything actionable still goes through the approval flow
 * and emergency stop.
 *
 * GATE (docs/06): enabling live proactive delivery (background scheduling +
 * notifications) requires the "before enabling proactive behavior" check-in
 * (D-0024). This engine computes and records on demand; it is not wired to a
 * background scheduler or push notifications until that check-in.
 */
export class ProactivityEngine {
  private gates: GateStack;

  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly activity: ActivityBus,
    gateConfig?: GateConfig,
    /** optional user-defined rules — add candidates, still gated (R-CAP-01) */
    private readonly rules?: ProactiveRules,
  ) {
    this.gates = new GateStack(pool, gateConfig);
  }

  /**
   * Run one proactivity cycle for `now`. Returns surfaced items + suppressions
   * (suppressions are never silent — R-PRO-02). Records survivors, emits to the
   * timeline. Deterministic in `now`.
   */
  async run(now: Date): Promise<{ surfaced: ProactiveItem[]; suppressed: Suppression[] }> {
    const candidates: Candidate[] = [
      ...(await commitmentCandidates(this.pool, now)),
      ...(await calendarConflictCandidates(this.pool, now)),
    ];
    const briefing = await briefingCandidate(this.pool, now);
    if (briefing) candidates.push(briefing);
    // User-defined rules add candidates; they pass the SAME gate stack (suggestion-
    // only, never act). Best-effort: a rule-evaluation failure must not break a cycle.
    if (this.rules) {
      try {
        candidates.push(...(await this.rules.evaluate(now)));
      } catch {
        /* rule evaluation is best-effort */
      }
    }

    const { surfaced, suppressed } = await this.gates.apply(candidates, now);

    const items: ProactiveItem[] = [];
    for (const c of surfaced) {
      const why = this.gates.explain(c);
      const { rows } = await this.pool.query<{ id: string; created_at: string }>(
        `INSERT INTO proactive_items (kind, priority, domain, title, detail, confidence, why, dedup_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (dedup_key) DO NOTHING
         RETURNING id, created_at::text`,
        [c.kind, c.priority, c.domain, c.title, c.detail, c.confidence, why, c.dedupKey],
      );
      if (!rows[0]) continue; // lost a dedup race
      const item: ProactiveItem = { ...c, id: rows[0].id, why, createdAt: rows[0].created_at };
      items.push(item);
      this.activity.emit({
        kind: "objective",
        text: `[proactive:${c.priority}] ${c.title} — ${c.detail}`,
        at: rows[0].created_at,
      });
    }

    await this.audit.append({
      actor: "kernel",
      event: "proactive_cycle",
      payload: { candidates: candidates.length, surfaced: items.length, suppressed: suppressed.length },
    });

    return { surfaced: items, suppressed };
  }

  async recent(limit = 20): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT id, kind, priority, domain, title, detail, confidence, why, created_at, acknowledged
       FROM proactive_items ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async snooze(dedupKey: string, until: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO proactive_snoozes (dedup_key, snoozed_until) VALUES ($1,$2)
       ON CONFLICT (dedup_key) DO UPDATE SET snoozed_until = EXCLUDED.snoozed_until, dismissed = false`,
      [dedupKey, until],
    );
  }

  async dismiss(dedupKey: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO proactive_snoozes (dedup_key, dismissed) VALUES ($1,true)
       ON CONFLICT (dedup_key) DO UPDATE SET dismissed = true`,
      [dedupKey],
    );
  }

  async setDomainEnabled(domain: string, enabled: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO proactive_domain_settings (domain, enabled) VALUES ($1,$2)
       ON CONFLICT (domain) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [domain, enabled],
    );
  }
}
