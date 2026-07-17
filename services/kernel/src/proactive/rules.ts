import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { Candidate, Priority } from "./types.js";
import { PRIORITY_ORDER } from "./types.js";

/**
 * User-defined proactivity rules (R-CAP-01 "rules" kind + R-PRO). A rule lets the
 * user configure WHAT J.A.R.V.I.S. is proactive about — a time-of-day nudge, or a
 * flag for commitments due within N minutes / already overdue. Rules produce
 * CANDIDATES only; they pass the same gate stack and never act (R-PRO).
 *
 * SAFETY: the condition is a CLOSED, TYPED set evaluated in code below — never an
 * arbitrary expression. An unknown condition type is refused on write, so a rule
 * can never execute code or escape the read-only, suggestion-only contract.
 */

export type RuleCondition =
  | { type: "part_of_day"; value: "morning" | "afternoon" | "evening" | "night" }
  | { type: "commitment_due_within"; minutes: number }
  | { type: "commitment_overdue" };

export interface ProactiveRule {
  id: string;
  name: string;
  enabled: boolean;
  domain: string;
  priority: Priority;
  title: string;
  detail: string;
  confidence: number;
  condition: RuleCondition;
  provenance: string;
  created_at: string;
  updated_at: string;
}

function partOfDay(now: Date): "morning" | "afternoon" | "evening" | "night" {
  const h = now.getHours();
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/** Validate + normalize an untrusted condition into the closed typed set. */
export function parseCondition(raw: unknown): RuleCondition {
  const c = raw as { type?: string; value?: string; minutes?: number };
  if (c?.type === "part_of_day") {
    if (!["morning", "afternoon", "evening", "night"].includes(c.value ?? "")) {
      throw new Error("refused: part_of_day needs value morning|afternoon|evening|night");
    }
    return { type: "part_of_day", value: c.value as "morning" | "afternoon" | "evening" | "night" };
  }
  if (c?.type === "commitment_due_within") {
    const m = Number(c.minutes);
    if (!Number.isFinite(m) || m <= 0) throw new Error("refused: commitment_due_within needs positive minutes");
    return { type: "commitment_due_within", minutes: Math.floor(m) };
  }
  if (c?.type === "commitment_overdue") return { type: "commitment_overdue" };
  throw new Error(`refused: unknown rule condition '${c?.type}' (allowed: part_of_day, commitment_due_within, commitment_overdue)`);
}

const COLS =
  "id, name, enabled, domain, priority, title, detail, confidence, condition, provenance, created_at::text, updated_at::text";

export class ProactiveRules {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
  ) {}

  async list(): Promise<ProactiveRule[]> {
    const { rows } = await this.pool.query<ProactiveRule>(`SELECT ${COLS} FROM proactive_rules ORDER BY name`);
    return rows;
  }

  async set(input: {
    name: string;
    title: string;
    condition: unknown;
    detail?: string;
    domain?: string;
    priority?: Priority;
    confidence?: number;
  }): Promise<ProactiveRule> {
    if (!input.name.trim()) throw new Error("refused: a rule needs a name");
    if (!input.title.trim()) throw new Error("refused: a rule needs a title");
    const condition = parseCondition(input.condition); // validates the closed set
    const priority: Priority = input.priority && PRIORITY_ORDER.includes(input.priority) ? input.priority : "normal";
    const { rows } = await this.pool.query<ProactiveRule>(
      `INSERT INTO proactive_rules (name, title, detail, domain, priority, confidence, condition)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (name) DO UPDATE SET
         title=EXCLUDED.title, detail=EXCLUDED.detail, domain=EXCLUDED.domain,
         priority=EXCLUDED.priority, confidence=EXCLUDED.confidence, condition=EXCLUDED.condition,
         enabled=true, updated_at=now()
       RETURNING ${COLS}`,
      [
        input.name,
        input.title,
        input.detail ?? "",
        input.domain ?? "general",
        priority,
        Math.max(0, Math.min(1, input.confidence ?? 0.8)),
        JSON.stringify(condition),
      ],
    );
    await this.audit.append({ actor: "user", event: "proactive_rule_set", payload: { name: input.name, condition: condition.type } });
    return rows[0]!;
  }

  async setEnabled(name: string, enabled: boolean): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE proactive_rules SET enabled = $2, updated_at = now() WHERE name = $1`,
      [name, enabled],
    );
    return (rowCount ?? 0) > 0;
  }

  async remove(name: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM proactive_rules WHERE name = $1`, [name]);
    if (rowCount) await this.audit.append({ actor: "user", event: "proactive_rule_removed", payload: { name } });
    return (rowCount ?? 0) > 0;
  }

  /**
   * Evaluate all ENABLED rules against `now` → candidates (read-only; the engine
   * then gates them). Every candidate carries a stable dedupKey so the gate stack
   * dedups/snoozes it like any other.
   */
  async evaluate(now: Date): Promise<Candidate[]> {
    const { rows } = await this.pool.query<ProactiveRule>(`SELECT ${COLS} FROM proactive_rules WHERE enabled`);
    const out: Candidate[] = [];
    const day = now.toISOString().slice(0, 10);
    for (const r of rows) {
      const cond = r.condition as RuleCondition;
      if (cond.type === "part_of_day") {
        if (partOfDay(now) === cond.value) {
          out.push(this.candidate(r, `rule:${r.id}:${cond.value}:${day}`, r.detail));
        }
      } else if (cond.type === "commitment_due_within") {
        const end = new Date(now.getTime() + cond.minutes * 60_000);
        const { rows: cs } = await this.pool.query<{ id: string; title: string; due_at: string }>(
          `SELECT id, title, due_at::text FROM commitments
           WHERE status = 'open' AND due_at >= $1 AND due_at <= $2 ORDER BY due_at ASC LIMIT 10`,
          [now.toISOString(), end.toISOString()],
        );
        for (const c of cs) {
          out.push(this.candidate(r, `rule:${r.id}:due:${c.id}`, this.fill(r.detail, c.title, c.due_at)));
        }
      } else if (cond.type === "commitment_overdue") {
        const { rows: cs } = await this.pool.query<{ id: string; title: string; due_at: string }>(
          `SELECT id, title, due_at::text FROM commitments
           WHERE status = 'open' AND due_at < $1 ORDER BY due_at ASC LIMIT 10`,
          [now.toISOString()],
        );
        for (const c of cs) {
          out.push(this.candidate(r, `rule:${r.id}:overdue:${c.id}`, this.fill(r.detail, c.title, c.due_at)));
        }
      }
    }
    return out;
  }

  private candidate(r: ProactiveRule, dedupKey: string, detail: string): Candidate {
    return {
      kind: "user_rule",
      priority: r.priority,
      domain: r.domain,
      title: r.title,
      detail: detail || r.title,
      confidence: r.confidence,
      dedupKey,
    };
  }

  /** Safe template fill — only {commitment} and {due} placeholders, plain replace. */
  private fill(detail: string, commitment: string, due: string): string {
    const base = detail || `Regarding {commitment}`;
    return base.replaceAll("{commitment}", commitment).replaceAll("{due}", due);
  }
}
