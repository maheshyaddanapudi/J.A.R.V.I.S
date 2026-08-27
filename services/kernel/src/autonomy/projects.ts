import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { Vault } from "../crypto/vault.js";
import type { Tool, ToolResult } from "../core/tools.js";

/**
 * Durable projects (D-0069) — the long-horizon spine. An agenda item is a single
 * intention; a PROJECT is a goal J.A.R.V.I.S. keeps working across many
 * heartbeats/days: a running progress log + a next action, advanced a bounded
 * step at a time until done. This is what "runs more companies than anyone"
 * decomposes to at core — persistent goals with resumable state. Goal + log
 * entries are encrypted at rest; secret-shaped input is refused (R-MEM-06).
 */
export interface Project {
  id: string;
  title: string;
  goal: string;
  status: "active" | "paused" | "done" | "abandoned";
  nextAction: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectLogEntry { at: string; entry: string; by: string }

export class Projects {
  constructor(private readonly pool: pg.Pool, private readonly audit: AuditLog, private readonly vault?: Vault) {}
  private enc(s: string): string { return this.vault && s ? this.vault.encrypt(s) : s; }
  private dec(s: string): string { return this.vault && s.startsWith("v1.gcm.") ? this.vault.decrypt(s) : s; }
  private assertClean(s: string): void {
    if (redactSecrets(s) !== s) throw new Error("refused: value looks like a secret — projects are goals, not credentials (R-MEM-06)");
  }
  private hydrate(r: Record<string, unknown>): Project {
    return {
      id: r.id as string, title: r.title as string, goal: this.dec((r.goal as string) ?? ""),
      status: r.status as Project["status"], nextAction: this.dec((r.next_action as string) ?? ""),
      createdBy: r.created_by as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    };
  }

  async start(input: { title: string; goal: string; nextAction?: string; createdBy: string }): Promise<Project> {
    if (!input.title.trim()) throw new Error("a project needs a title");
    this.assertClean(input.goal); if (input.nextAction) this.assertClean(input.nextAction);
    const { rows } = await this.pool.query(
      `INSERT INTO projects (title, goal, next_action, created_by) VALUES ($1,$2,$3,$4)
       RETURNING id, title, goal, status, next_action, created_by, created_at::text, updated_at::text`,
      [input.title.trim(), this.enc(input.goal.trim()), this.enc(input.nextAction?.trim() ?? ""), input.createdBy],
    );
    const p = this.hydrate(rows[0]);
    await this.pool.query(`INSERT INTO project_log (project_id, entry, by) VALUES ($1,$2,$3)`, [p.id, this.enc("project started"), input.createdBy]);
    await this.audit.append({ actor: "kernel", event: "project_started", payload: { id: p.id, title: p.title, by: input.createdBy } });
    return p;
  }

  async active(limit = 5): Promise<Project[]> {
    const { rows } = await this.pool.query(
      `SELECT id, title, goal, status, next_action, created_by, created_at::text, updated_at::text
       FROM projects WHERE status = 'active' ORDER BY updated_at ASC LIMIT $1`, [limit],
    );
    return rows.map((r) => this.hydrate(r));
  }
  async list(status?: Project["status"]): Promise<Project[]> {
    const { rows } = await this.pool.query(
      `SELECT id, title, goal, status, next_action, created_by, created_at::text, updated_at::text
       FROM projects ${status ? "WHERE status = $1" : ""} ORDER BY updated_at DESC LIMIT 50`,
      status ? [status] : [],
    );
    return rows.map((r) => this.hydrate(r));
  }
  async log(id: string, limit = 20): Promise<ProjectLogEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT at::text, entry, by FROM project_log WHERE project_id = $1 ORDER BY at DESC LIMIT $2`, [id, limit],
    );
    return rows.map((r) => ({ at: r.at as string, entry: this.dec(r.entry as string), by: r.by as string }));
  }

  /** Record progress + set the next action (the resumable state). */
  async note(id: string, progress: string, nextAction?: string, by = "jarvis"): Promise<boolean> {
    this.assertClean(progress); if (nextAction) this.assertClean(nextAction);
    const { rowCount } = await this.pool.query(`SELECT 1 FROM projects WHERE id = $1 AND status = 'active'`, [id]);
    if (!rowCount) return false;
    await this.pool.query(`INSERT INTO project_log (project_id, entry, by) VALUES ($1,$2,$3)`, [id, this.enc(progress), by]);
    if (nextAction !== undefined) await this.pool.query(`UPDATE projects SET next_action = $2, updated_at = now() WHERE id = $1`, [id, this.enc(nextAction)]);
    else await this.pool.query(`UPDATE projects SET updated_at = now() WHERE id = $1`, [id]);
    await this.audit.append({ actor: "kernel", event: "project_progress", payload: { id, by } });
    return true;
  }
  async setStatus(id: string, status: Project["status"], note?: string, by = "jarvis"): Promise<boolean> {
    const { rowCount } = await this.pool.query(`UPDATE projects SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
    if (rowCount && note) await this.pool.query(`INSERT INTO project_log (project_id, entry, by) VALUES ($1,$2,$3)`, [id, this.enc(`[${status}] ${note}`), by]);
    if (rowCount) await this.audit.append({ actor: "kernel", event: "project_status", payload: { id, status, by } });
    return (rowCount ?? 0) > 0;
  }
}

export function projectTools(projects: Projects): Tool[] {
  const start: Tool = {
    name: "project.start",
    description: "Begin a durable PROJECT — a long-horizon goal you'll keep working across many heartbeats until done (unlike a one-shot agenda item). Give a title, the goal, and the first next action.",
    riskClass: "LOW_REVERSIBLE",
    action: "start a project",
    inputSchema: { type: "object", properties: { title: { type: "string" }, goal: { type: "string" }, nextAction: { type: "string" } }, required: ["title", "goal"], additionalProperties: false },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { title: string; goal: string; nextAction?: string };
      const p = await projects.start({ title: a.title, goal: a.goal, ...(a.nextAction ? { nextAction: a.nextAction } : {}), createdBy: "jarvis" });
      return { ok: true, summary: `project started: "${p.title}"`, data: { id: p.id, title: p.title } };
    },
  };
  const note: Tool = {
    name: "project.note",
    description: "Record progress on a project and set what to do next (the resumable state a future heartbeat picks up). Use this each time you advance a project.",
    riskClass: "LOW_REVERSIBLE",
    action: "record project progress",
    inputSchema: { type: "object", properties: { id: { type: "string" }, progress: { type: "string" }, nextAction: { type: "string" } }, required: ["id", "progress"], additionalProperties: false },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { id: string; progress: string; nextAction?: string };
      const ok = await projects.note(a.id, a.progress, a.nextAction);
      return { ok: true, summary: ok ? `progress noted on project ${a.id}` : `no active project ${a.id}`, data: { id: a.id, noted: ok } };
    },
  };
  const list: Tool = {
    name: "project.list",
    description: "List your projects (active goals + their next actions). Read-only.",
    riskClass: "READ_ONLY",
    action: "list projects",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["active", "paused", "done", "abandoned"] } }, additionalProperties: false },
    async run(args: unknown): Promise<ToolResult> {
      const a = (args ?? {}) as { status?: Project["status"] };
      const ps = a.status ? await projects.list(a.status) : await projects.active(10);
      return { ok: true, summary: `${ps.length} project(s)`, data: ps, detail: ps.map((p) => `[${p.status}] (${p.id}) ${p.title} — goal: ${p.goal}; next: ${p.nextAction || "—"}`).join("\n") || "no projects" };
    },
  };
  const complete: Tool = {
    name: "project.complete",
    description: "Mark a project done (or paused/abandoned), recording the outcome.",
    riskClass: "LOW_REVERSIBLE",
    action: "close a project",
    inputSchema: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["done", "paused", "abandoned"] }, outcome: { type: "string" } }, required: ["id", "outcome"], additionalProperties: false },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { id: string; status?: Project["status"]; outcome: string };
      const ok = await projects.setStatus(a.id, a.status ?? "done", a.outcome);
      return { ok: true, summary: ok ? `project ${a.id} → ${a.status ?? "done"}` : `no project ${a.id}`, data: { id: a.id, ok } };
    },
  };
  return [start, note, list, complete];
}
