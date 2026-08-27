import type pg from "pg";
import {
  DEFAULT_GATES,
  priorityAtLeast,
  type Candidate,
  type GateConfig,
  type ProactiveItem,
  type Suppression,
} from "./types.js";

/**
 * The gate stack (R-PRO-02). Every candidate must survive ALL gates to surface.
 * Each suppression is recorded with its reason — proactive behavior is never
 * silent about why it did (or didn't) speak.
 *
 * Order: per-domain enable → min priority → confidence → quiet hours → snooze/
 * dismiss → dedup → rate limit. Critical items bypass quiet hours (and only
 * quiet hours) — a fire alarm speaks at 3am; a briefing does not.
 */
export class GateStack {
  constructor(
    private readonly pool: pg.Pool,
    private readonly gates: GateConfig = DEFAULT_GATES,
  ) {}

  /**
   * Filter candidates. `now` is passed in (never read from a wall clock here) so
   * the gates are deterministic and testable.
   */
  async apply(
    candidates: Candidate[],
    now: Date,
  ): Promise<{ surfaced: Candidate[]; suppressed: Suppression[] }> {
    const surfaced: Candidate[] = [];
    const suppressed: Suppression[] = [];

    const domainEnabled = await this.loadDomainSettings();
    const snoozes = await this.loadSnoozes();
    const existing = await this.loadRecentDedupKeys();
    const hour = now.getHours();
    let surfacedInWindow = await this.countRecent(now);

    // Highest priority first so the rate limit spends budget on what matters.
    const ordered = [...candidates].sort(
      (a, b) => priorityRank(b.priority) - priorityRank(a.priority),
    );

    for (const c of ordered) {
      // per-domain enable
      if (domainEnabled.get(c.domain) === false) {
        suppressed.push({ candidate: c, gate: "domain", reason: `domain '${c.domain}' disabled` });
        continue;
      }
      // min priority
      if (!priorityAtLeast(c.priority, this.gates.minPriority)) {
        suppressed.push({ candidate: c, gate: "priority", reason: `below min '${this.gates.minPriority}'` });
        continue;
      }
      // confidence
      if (c.confidence < this.gates.confidenceThreshold) {
        suppressed.push({
          candidate: c,
          gate: "confidence",
          reason: `confidence ${c.confidence.toFixed(2)} < ${this.gates.confidenceThreshold}`,
        });
        continue;
      }
      // quiet hours (critical bypasses)
      if (this.gates.quietHours && c.priority !== "critical" && inQuietHours(hour, this.gates.quietHours)) {
        suppressed.push({ candidate: c, gate: "quiet_hours", reason: `quiet hours (hour ${hour})` });
        continue;
      }
      // snooze / dismiss
      const snooze = snoozes.get(c.dedupKey);
      if (snooze?.dismissed) {
        suppressed.push({ candidate: c, gate: "dismissed", reason: "dismissed by user" });
        continue;
      }
      if (snooze?.snoozedUntil && snooze.snoozedUntil > now) {
        suppressed.push({ candidate: c, gate: "snoozed", reason: `snoozed until ${snooze.snoozedUntil.toISOString()}` });
        continue;
      }
      // dedup — already surfaced this exact alert
      if (existing.has(c.dedupKey)) {
        suppressed.push({ candidate: c, gate: "dedup", reason: "already surfaced" });
        continue;
      }
      // rate limit
      if (surfacedInWindow >= this.gates.rateLimit.max) {
        suppressed.push({ candidate: c, gate: "rate_limit", reason: `>= ${this.gates.rateLimit.max}/${this.gates.rateLimit.windowMinutes}min` });
        continue;
      }

      surfaced.push(c);
      surfacedInWindow += 1;
      existing.add(c.dedupKey); // prevent duplicates within this batch too
    }

    return { surfaced, suppressed };
  }

  /** Compose the "why am I seeing this" explanation for a surfaced item. */
  explain(c: Candidate): string {
    const bits: string[] = [];
    bits.push(`${c.kind.replace(/_/g, " ")} in '${c.domain}'`);
    bits.push(`priority ${c.priority}`);
    bits.push(`confidence ${(c.confidence * 100).toFixed(0)}%`);
    return `Surfaced because: ${bits.join(", ")}. Snooze or dismiss to stop this alert.`;
  }

  private async loadDomainSettings(): Promise<Map<string, boolean>> {
    const { rows } = await this.pool.query<{ domain: string; enabled: boolean }>(
      "SELECT domain, enabled FROM proactive_domain_settings",
    );
    return new Map(rows.map((r) => [r.domain, r.enabled]));
  }

  private async loadSnoozes(): Promise<
    Map<string, { snoozedUntil: Date | null; dismissed: boolean }>
  > {
    const { rows } = await this.pool.query<{
      dedup_key: string;
      snoozed_until: Date | null;
      dismissed: boolean;
    }>("SELECT dedup_key, snoozed_until, dismissed FROM proactive_snoozes");
    return new Map(
      rows.map((r) => [r.dedup_key, { snoozedUntil: r.snoozed_until, dismissed: r.dismissed }]),
    );
  }

  private async loadRecentDedupKeys(): Promise<Set<string>> {
    const { rows } = await this.pool.query<{ dedup_key: string }>(
      "SELECT dedup_key FROM proactive_items WHERE acknowledged = false",
    );
    return new Set(rows.map((r) => r.dedup_key));
  }

  private async countRecent(now: Date): Promise<number> {
    const windowStart = new Date(now.getTime() - this.gates.rateLimit.windowMinutes * 60_000);
    const { rows } = await this.pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM proactive_items WHERE created_at >= $1",
      [windowStart],
    );
    return Number(rows[0]!.n);
  }
}

function inQuietHours(hour: number, q: { start: number; end: number }): boolean {
  // handles windows that wrap midnight (e.g. 22..7)
  return q.start <= q.end ? hour >= q.start && hour < q.end : hour >= q.start || hour < q.end;
}

function priorityRank(p: ProactiveItem["priority"]): number {
  return { low: 0, normal: 1, high: 2, critical: 3 }[p];
}
