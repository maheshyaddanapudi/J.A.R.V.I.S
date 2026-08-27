import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { AgentResult, AgentRuntime } from "../agent/contract.js";

/**
 * Skills registry (R-CAP-01). A **skill** is a saved, named objective the user
 * can re-run — the reusable-task layer over the agent runtime. Running a skill
 * executes its objective through the agent, which runs every step through the
 * gated core loop: a skill therefore grants NO new capability and cannot bypass
 * approval; it only names and reuses what the agent can already do.
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  objective: string;
  maxSteps: number;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
}

interface SkillRow {
  id: string;
  name: string;
  description: string;
  objective: string;
  max_steps: number;
  enabled: boolean;
  created_at: string;
  last_run_at: string | null;
}

const toSkill = (r: SkillRow): Skill => ({
  id: r.id, name: r.name, description: r.description, objective: r.objective,
  maxSteps: r.max_steps, enabled: r.enabled, createdAt: r.created_at, lastRunAt: r.last_run_at,
});

export class SkillRegistry {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly agent: AgentRuntime,
  ) {}

  async create(input: {
    name: string;
    objective: string;
    description?: string;
    maxSteps?: number;
    /** who authored it — J.A.R.V.I.S. can now self-author a reusable skill (D-0075) */
    createdBy?: "user" | "jarvis";
  }): Promise<Skill> {
    const name = input.name.trim();
    if (!name) throw new Error("skill name required");
    if (!input.objective.trim()) throw new Error("skill objective required");
    // supersede any existing active skill of the same name (disable it) first,
    // so the unique-active-name index holds.
    await this.pool.query("UPDATE skills SET enabled = false, updated_at = now() WHERE name = $1 AND enabled = true", [name]);
    const { rows } = await this.pool.query<SkillRow>(
      `INSERT INTO skills (name, description, objective, max_steps)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, description, objective, max_steps, enabled, created_at::text, last_run_at::text`,
      [name, input.description ?? "", input.objective.trim(), input.maxSteps ?? 6],
    );
    const actor = input.createdBy === "jarvis" ? "jarvis" : "user";
    await this.audit.append({ actor, event: "skill_created", payload: { name, by: actor } });
    return toSkill(rows[0]!);
  }

  /** Resolve an active skill by name (case-insensitive) — so J.A.R.V.I.S. can
   *  re-run a skill it knows by name, not only by id. */
  async getByName(name: string): Promise<Skill | null> {
    const { rows } = await this.pool.query<SkillRow>(
      `SELECT id, name, description, objective, max_steps, enabled, created_at::text, last_run_at::text
         FROM skills WHERE lower(name) = lower($1) AND enabled = true ORDER BY created_at DESC LIMIT 1`,
      [name.trim()],
    );
    return rows[0] ? toSkill(rows[0]) : null;
  }

  async list(): Promise<Skill[]> {
    const { rows } = await this.pool.query<SkillRow>(
      `SELECT id, name, description, objective, max_steps, enabled, created_at::text, last_run_at::text
         FROM skills WHERE enabled = true ORDER BY name`,
    );
    return rows.map(toSkill);
  }

  async get(id: string): Promise<Skill | null> {
    const { rows } = await this.pool.query<SkillRow>(
      `SELECT id, name, description, objective, max_steps, enabled, created_at::text, last_run_at::text
         FROM skills WHERE id = $1`,
      [id],
    );
    return rows[0] ? toSkill(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "UPDATE skills SET enabled = false, updated_at = now() WHERE id = $1 AND enabled = true",
      [id],
    );
    if (rowCount) await this.audit.append({ actor: "user", event: "skill_deleted", payload: { id } });
    return Boolean(rowCount);
  }

  /**
   * Run a skill: execute its objective through the agent runtime. Every step is
   * gated; a consequential step still requires approval (autoApprove is a
   * scripted/testing convenience only).
   */
  async run(
    id: string,
    opts?: { autoApprove?: AgentRunOpts["autoApprove"]; privacyClass?: AgentRunOpts["privacyClass"] },
  ): Promise<AgentResult | null> {
    const skill = await this.get(id);
    if (!skill || !skill.enabled) return null;
    await this.audit.append({ actor: "user", event: "skill_run", payload: { id, name: skill.name } });
    const result = await this.agent.run(skill.objective, {
      maxSteps: skill.maxSteps,
      source: `skill:${skill.name}`,
      // LOCAL_ONLY by default (private-first); a skill may opt into STANDARD to
      // use a remote reasoning provider when the user wants it.
      ...(opts?.privacyClass ? { privacyClass: opts.privacyClass } : {}),
      ...(opts?.autoApprove ? { autoApprove: opts.autoApprove } : {}),
    });
    await this.pool.query("UPDATE skills SET last_run_at = now() WHERE id = $1", [id]);
    return result;
  }
}

type AgentRunOpts = NonNullable<Parameters<AgentRuntime["run"]>[1]>;
