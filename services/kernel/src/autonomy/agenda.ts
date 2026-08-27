import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { Tool, ToolResult } from "../core/tools.js";

/**
 * J.A.R.V.I.S.'s OWN intention ledger (D-0064) — what it means to do at future
 * heartbeats, written by ITSELF (mid-conversation or on a heartbeat), by the
 * user, or by the sleep cycle. This is the difference between a timer that runs
 * a fixed script and something that carries intentions forward in time.
 * Dual-editable (D-0053): the user sees, adds, completes, and drops items the
 * same as J.A.R.V.I.S. does. Secret-shaped content is redacted, never stored.
 */
export interface AgendaItem {
  id: string;
  what: string;
  why: string;
  status: "pending" | "done" | "dropped";
  dueAt: string | null;
  outcome: string;
  provenance: string;
  createdAt: string;
  updatedAt: string;
}

export class Agenda {
  constructor(private readonly pool: pg.Pool, private readonly audit: AuditLog) {}

  private hydrate(r: Record<string, unknown>): AgendaItem {
    return {
      id: r.id as string, what: r.what as string, why: r.why as string,
      status: r.status as AgendaItem["status"], dueAt: (r.due_at as string) ?? null,
      outcome: r.outcome as string, provenance: r.provenance as string,
      createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    };
  }

  async add(input: { what: string; why?: string; dueAt?: string; provenance: string }): Promise<AgendaItem> {
    if (!input.what.trim()) throw new Error("an agenda item needs a 'what'");
    const { rows } = await this.pool.query(
      `INSERT INTO agenda_items (what, why, due_at, provenance)
       VALUES ($1,$2,$3,$4)
       RETURNING id, what, why, status, due_at::text, outcome, provenance, created_at::text, updated_at::text`,
      [redactSecrets(input.what.trim()), redactSecrets(input.why?.trim() ?? ""), input.dueAt ?? null, input.provenance],
    );
    await this.audit.append({ actor: "kernel", event: "agenda_added", payload: { id: rows[0].id, provenance: input.provenance } });
    return this.hydrate(rows[0]);
  }

  /** All pending items that are due now (due_at null = "next heartbeat"). */
  async due(now: Date = new Date()): Promise<AgendaItem[]> {
    const { rows } = await this.pool.query(
      `SELECT id, what, why, status, due_at::text, outcome, provenance, created_at::text, updated_at::text
       FROM agenda_items WHERE status = 'pending' AND (due_at IS NULL OR due_at <= $1)
       ORDER BY created_at ASC LIMIT 20`,
      [now.toISOString()],
    );
    return rows.map((r) => this.hydrate(r));
  }

  async list(status?: AgendaItem["status"], limit = 50): Promise<AgendaItem[]> {
    const { rows } = await this.pool.query(
      `SELECT id, what, why, status, due_at::text, outcome, provenance, created_at::text, updated_at::text
       FROM agenda_items ${status ? "WHERE status = $2" : ""} ORDER BY created_at DESC LIMIT $1`,
      status ? [limit, status] : [limit],
    );
    return rows.map((r) => this.hydrate(r));
  }

  async resolve(id: string, status: "done" | "dropped", outcome: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE agenda_items SET status = $2, outcome = $3, updated_at = now() WHERE id = $1 AND status = 'pending'`,
      [id, status, redactSecrets(outcome)],
    );
    if (rowCount) await this.audit.append({ actor: "kernel", event: `agenda_${status}`, payload: { id } });
    return (rowCount ?? 0) > 0;
  }
}

/** Gated agenda tools — how J.A.R.V.I.S. writes/works its own intentions. */
export function agendaTools(agenda: Agenda): Tool[] {
  const add: Tool = {
    name: "agenda.add",
    description:
      "Write an intention onto YOUR OWN agenda — something to do at a future heartbeat (or a specific time). " +
      "Use this whenever you notice something worth following up on, or when an action needs the user's approval " +
      "(queue it here so it isn't lost). Items are visible to the user and reviewed on every heartbeat.",
    riskClass: "LOW_REVERSIBLE",
    action: "add agenda intention",
    inputSchema: {
      type: "object",
      properties: {
        what: { type: "string", description: "the intention (imperative, specific)" },
        why: { type: "string", description: "why it matters" },
        dueAt: { type: "string", description: "ISO time to act; omit = next heartbeat" },
      },
      required: ["what"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { what: string; why?: string; dueAt?: string };
      const item = await agenda.add({ what: a.what, ...(a.why ? { why: a.why } : {}), ...(a.dueAt ? { dueAt: a.dueAt } : {}), provenance: "jarvis" });
      return { ok: true, summary: `agenda: "${item.what}"${item.dueAt ? ` (due ${item.dueAt})` : " (next heartbeat)"}`, data: item };
    },
  };
  const list: Tool = {
    name: "agenda.list",
    description: "List your agenda (pending intentions and recent outcomes). Read-only.",
    riskClass: "READ_ONLY",
    action: "list agenda",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["pending", "done", "dropped"] } }, additionalProperties: false },
    async run(args: unknown): Promise<ToolResult> {
      const a = (args ?? {}) as { status?: AgendaItem["status"] };
      const items = await agenda.list(a.status);
      return {
        ok: true,
        summary: `${items.length} agenda item(s)`,
        data: items,
        detail: items.map((i) => `[${i.status}] (${i.id}) ${i.what}${i.why ? ` — ${i.why}` : ""}${i.outcome ? ` → ${i.outcome}` : ""}`).join("\n") || "agenda is empty",
      };
    },
  };
  const complete: Tool = {
    name: "agenda.complete",
    description: "Mark one of your agenda items done, recording what happened.",
    riskClass: "LOW_REVERSIBLE",
    action: "complete agenda item",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, outcome: { type: "string" } },
      required: ["id", "outcome"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { id: string; outcome: string };
      const ok = await agenda.resolve(a.id, "done", a.outcome);
      return { ok: true, summary: ok ? `agenda item done: ${a.outcome.slice(0, 80)}` : `no pending agenda item ${a.id}`, data: { id: a.id, done: ok } };
    },
  };
  const drop: Tool = {
    name: "agenda.drop",
    description: "Drop one of your agenda items (no longer relevant), recording why.",
    riskClass: "LOW_REVERSIBLE",
    action: "drop agenda item",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, why: { type: "string" } },
      required: ["id", "why"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { id: string; why: string };
      const ok = await agenda.resolve(a.id, "dropped", a.why);
      return { ok: true, summary: ok ? `agenda item dropped (${a.why.slice(0, 80)})` : `no pending agenda item ${a.id}`, data: { id: a.id, dropped: ok } };
    },
  };
  return [add, list, complete, drop];
}
