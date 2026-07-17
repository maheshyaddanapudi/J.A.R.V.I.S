import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";

/**
 * Prompts registry (R-CAP-01 — the "prompts" entity kind). J.A.R.V.I.S.'s persona
 * and named system prompts as versioned, user-editable data rather than hardcoded
 * strings. The conversation loop reads the ACTIVE `persona` prompt; the built-in
 * default remains the fallback so there is never a blank persona.
 *
 * Supersede-with-history (R-MEM-05): setting a prompt marks the prior active one
 * inactive (kept for history) and inserts a new active row with an incremented
 * version. Secrets are redacted on write (a persona should never carry a key).
 */

export type PromptKind = "persona" | "system" | "template";

export interface Prompt {
  id: string;
  name: string;
  kind: PromptKind;
  content: string;
  active: boolean;
  version: number;
  provenance: string;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id, name, kind, content, active, version, provenance, created_at::text, updated_at::text";

export class PromptRegistry {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
  ) {}

  /** The active prompt for a kind (default kind = persona). */
  async getActive(kind: PromptKind = "persona"): Promise<Prompt | null> {
    const { rows } = await this.pool.query<Prompt>(
      `SELECT ${COLS} FROM prompts WHERE kind = $1 AND active ORDER BY updated_at DESC LIMIT 1`,
      [kind],
    );
    return rows[0] ?? null;
  }

  /** The active persona's content, or the provided fallback if none is set. */
  async activePersonaOr(fallback: string): Promise<string> {
    try {
      const p = await this.getActive("persona");
      return p?.content?.trim() ? p.content : fallback;
    } catch {
      return fallback; // registry unavailable → never a blank persona
    }
  }

  async list(kind?: PromptKind, includeInactive = false): Promise<Prompt[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (kind) {
      params.push(kind);
      where.push(`kind = $${params.length}`);
    }
    if (!includeInactive) where.push("active");
    const { rows } = await this.pool.query<Prompt>(
      `SELECT ${COLS} FROM prompts ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY kind, name, version DESC`,
      params,
    );
    return rows;
  }

  async get(name: string, kind: PromptKind = "persona"): Promise<Prompt | null> {
    const { rows } = await this.pool.query<Prompt>(
      `SELECT ${COLS} FROM prompts WHERE name = $1 AND kind = $2 AND active LIMIT 1`,
      [name, kind],
    );
    return rows[0] ?? null;
  }

  /**
   * Set (create or supersede) a named prompt and make it the active one for its
   * (name, kind). Any other active prompt of the same kind is deactivated so the
   * loop reads exactly one active persona.
   */
  async set(input: { name: string; kind?: PromptKind; content: string; provenance?: string }): Promise<Prompt> {
    if (!input.name.trim()) throw new Error("refused: a prompt needs a name");
    if (!input.content.trim()) throw new Error("refused: a prompt needs content");
    const kind: PromptKind = input.kind ?? "persona";
    const content = redactSecrets(input.content); // a persona must never carry a secret
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // previous version of THIS (name, kind), if any → carry the version forward
      const prev = await client.query<{ version: number }>(
        `SELECT version FROM prompts WHERE name = $1 AND kind = $2 AND active ORDER BY version DESC LIMIT 1`,
        [input.name, kind],
      );
      const nextVersion = (prev.rows[0]?.version ?? 0) + 1;
      // deactivate every currently-active prompt of this kind (one active persona)
      await client.query(`UPDATE prompts SET active = false, updated_at = now() WHERE kind = $1 AND active`, [kind]);
      const { rows } = await client.query<Prompt>(
        `INSERT INTO prompts (name, kind, content, active, version, provenance)
         VALUES ($1,$2,$3,true,$4,$5) RETURNING ${COLS}`,
        [input.name, kind, content, nextVersion, input.provenance ?? "user"],
      );
      await client.query("COMMIT");
      await this.audit.append({
        actor: "user",
        event: "prompt_set",
        payload: { name: input.name, kind, version: nextVersion },
      });
      return rows[0]!;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Activate an existing (named) prompt, deactivating the others of its kind. */
  async activate(name: string, kind: PromptKind = "persona"): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(`SELECT 1 FROM prompts WHERE name = $1 AND kind = $2 LIMIT 1`, [name, kind]);
      if (found.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(`UPDATE prompts SET active = false, updated_at = now() WHERE kind = $1 AND active`, [kind]);
      await client.query(
        `UPDATE prompts SET active = true, updated_at = now()
         WHERE id = (SELECT id FROM prompts WHERE name = $1 AND kind = $2 ORDER BY version DESC LIMIT 1)`,
        [name, kind],
      );
      await client.query("COMMIT");
      await this.audit.append({ actor: "user", event: "prompt_activated", payload: { name, kind } });
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Remove a named prompt entirely (all versions). */
  async remove(name: string, kind: PromptKind = "persona"): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM prompts WHERE name = $1 AND kind = $2`, [name, kind]);
    if (rowCount) await this.audit.append({ actor: "user", event: "prompt_removed", payload: { name, kind } });
    return (rowCount ?? 0) > 0;
  }
}
