import type pg from "pg";
import type { SettingsRegistry } from "../settings/registry.js";

/**
 * Spend/resource governance (D-0066) — the self-restraint J.A.R.V.I.S. needs to
 * be trusted with its own time. A buggy every-tick heartbeat could otherwise
 * burn the API budget silently; this meters real token spend (from the
 * `model_calls` audit, R-MODEL-03) and lets AUTONOMY be hard-capped.
 *
 * Design choices (deliberate):
 *  - Token caps are the primary guard — provider-agnostic and exact. A cost
 *    ESTIMATE (USD) is display-only, from a small built-in price table.
 *  - Autonomy has its OWN daily cap. When exhausted, background thinking stops;
 *    a LIVE user turn is NEVER blocked (locking you out of your own assistant
 *    would be worse than the spend). The overall cap therefore only gates
 *    autonomy + surfaces a warning; it never refuses a conversation.
 *  - "Today" = since local midnight is fuzzy across TZ; we use a rolling 24h
 *    window, which is what "per day" means for a continuously-running agent.
 */

/** $ per 1M tokens (input, output). Display-only estimate; unknown models → 0. */
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-fable-5": { in: 10, out: 50 },
};

/** Sources that count as AUTONOMY (self-driven), meterable against the autonomy cap. */
const AUTONOMY_SOURCES = ["heartbeat", "sleep-cycle", "autonomy", "proactive", "night-lab"];

export interface BudgetStatus {
  windowHours: number;
  interactive: { tokens: number; usd: number };
  autonomy: { tokens: number; usd: number };
  total: { tokens: number; usd: number };
  autonomyCap: number;   // 0 = unlimited
  autonomyRemaining: number | null; // null = unlimited
  dailyCap: number;      // 0 = unlimited
  overBudget: boolean;   // total ≥ dailyCap (dailyCap>0)
  autonomyExhausted: boolean; // autonomy ≥ autonomyCap (cap>0)
}

export class Budget {
  constructor(private readonly pool: pg.Pool, private readonly settings: SettingsRegistry) {}

  private usd(model: string | null, inTok: number, outTok: number): number {
    const p = model ? PRICE_PER_MTOK[model] : undefined;
    if (!p) return 0;
    return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
  }

  /** Token + estimated-cost usage over the rolling window, split interactive/autonomy. */
  async status(windowHours = 24): Promise<BudgetStatus> {
    const { rows } = await this.pool.query<{
      source: string; model: string | null; in_tok: string; out_tok: string;
    }>(
      `SELECT source, model, sum(input_tokens) in_tok, sum(output_tokens) out_tok
         FROM model_calls
        WHERE at > now() - ($1 || ' hours')::interval
        GROUP BY source, model`,
      [windowHours],
    );
    let iTok = 0, iUsd = 0, aTok = 0, aUsd = 0;
    for (const r of rows) {
      const inT = Number(r.in_tok), outT = Number(r.out_tok);
      const usd = this.usd(r.model, inT, outT);
      const isAutonomy = AUTONOMY_SOURCES.some((s) => (r.source ?? "").startsWith(s));
      if (isAutonomy) { aTok += inT + outT; aUsd += usd; }
      else { iTok += inT + outT; iUsd += usd; }
    }
    const autonomyCap = await this.settings.num("budget.autonomy.dailyTokenCap", 500_000);
    const dailyCap = await this.settings.num("budget.dailyTokenCap", 0);
    const totalTok = iTok + aTok;
    return {
      windowHours,
      interactive: { tokens: iTok, usd: round(iUsd) },
      autonomy: { tokens: aTok, usd: round(aUsd) },
      total: { tokens: totalTok, usd: round(iUsd + aUsd) },
      autonomyCap,
      autonomyRemaining: autonomyCap > 0 ? Math.max(0, autonomyCap - aTok) : null,
      dailyCap,
      overBudget: dailyCap > 0 && totalTok >= dailyCap,
      autonomyExhausted: autonomyCap > 0 && aTok >= autonomyCap,
    };
  }

  /**
   * May autonomy spend more right now? Consulted BEFORE a heartbeat brain pass /
   * sleep cycle. Blocks if the autonomy cap OR the overall daily cap is hit.
   * Returns a reason for the journal when it blocks. Fail-open on error (a
   * metering glitch must not permanently freeze autonomy — the caps are a guard
   * against runaways, not a lock).
   */
  async allowAutonomy(): Promise<{ allowed: boolean; reason?: string; status: BudgetStatus }> {
    const s = await this.status();
    if (s.autonomyExhausted) return { allowed: false, reason: `autonomy token cap reached (${s.autonomy.tokens}/${s.autonomyCap} in ${s.windowHours}h)`, status: s };
    if (s.overBudget) return { allowed: false, reason: `daily token cap reached (${s.total.tokens}/${s.dailyCap}) — autonomy paused, conversation still available`, status: s };
    return { allowed: true, status: s };
  }
}

function round(n: number): number { return Math.round(n * 10000) / 10000; }
