import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";

/**
 * Memory service (slice 1.6). Phase-1 stores: conversation + preferences.
 *
 * Every item carries provenance, epistemic status, confidence, sensitivity, and
 * timestamps (R-MEM-03/05). Secrets never enter memory rows — values are
 * redacted on write and rejected if they still look secret (R-MEM-06). Deletion
 * is honored in retrieval immediately (soft-delete → excluded), and forget()
 * purges physically.
 */

export type EpistemicStatus =
  | "verified_fact"
  | "user_statement"
  | "external_claim"
  | "inferred_preference"
  | "temporary_context"
  | "simulated_data"
  | "uncertain"
  | "superseded"
  | "deleted";

export type Sensitivity = "public" | "personal" | "private" | "secret";

export interface Preference {
  id: string;
  key: string;
  value: string;
  status: EpistemicStatus;
  provenance: string;
  confidence: number;
  sensitivity: Sensitivity;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

// A value that still matches a secret pattern after redaction must never be
// stored in conversational memory (R-MEM-06) — the caller is told to use the
// secrets vault instead.
function assertNotSecret(value: string): void {
  if (redactSecrets(value) !== value) {
    throw new Error(
      "refused: value looks like a secret — store credentials in the secrets vault, not memory (R-MEM-06)",
    );
  }
}

export class MemoryService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
  ) {}

  // --- conversation store ---

  async addTurn(sessionId: string, role: "user" | "assistant", content: string): Promise<string> {
    const safe = redactSecrets(content);
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO conversation_memory (session_id, role, content) VALUES ($1,$2,$3) RETURNING id`,
      [sessionId, role, safe],
    );
    return rows[0]!.id;
  }

  async conversation(sessionId: string, limit = 50): Promise<
    { role: string; content: string; created_at: string }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT role, content, created_at::text FROM conversation_memory
       WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [sessionId, limit],
    );
    return rows.reverse();
  }

  // --- preference store (CRUD + user control) ---

  /**
   * Remember a preference. If the key already has an active row, that row is
   * marked superseded and a new one is inserted (history preserved, R-MEM-05).
   */
  async remember(input: {
    key: string;
    value: string;
    status?: EpistemicStatus;
    provenance: string;
    confidence?: number;
    sensitivity?: Sensitivity;
  }): Promise<Preference> {
    assertNotSecret(input.value);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Supersede the prior active row FIRST so the unique-active-key index
      // never sees two active rows for the same key mid-transaction.
      const superseded = await client.query<{ id: string }>(
        `UPDATE preferences SET status = 'superseded', updated_at = now()
         WHERE key = $1 AND status NOT IN ('deleted','superseded')
         RETURNING id`,
        [input.key],
      );
      const inserted = await client.query<Preference>(
        `INSERT INTO preferences (key, value, status, provenance, confidence, sensitivity)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, key, value, status, provenance, confidence, sensitivity, pinned,
                   created_at::text, updated_at::text, last_used_at::text, expires_at::text`,
        [
          input.key,
          input.value,
          input.status ?? "user_statement",
          input.provenance,
          input.confidence ?? 1.0,
          input.sensitivity ?? "personal",
        ],
      );
      const row = inserted.rows[0]!;
      if (superseded.rows[0]) {
        await client.query(`UPDATE preferences SET superseded_by = $1 WHERE id = $2`, [
          row.id,
          superseded.rows[0].id,
        ]);
      }
      await client.query("COMMIT");
      await this.audit.append({
        actor: "kernel",
        event: "memory_remember",
        payload: { key: input.key, status: row.status, provenance: input.provenance },
      });
      return row;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async get(key: string): Promise<Preference | null> {
    const { rows } = await this.pool.query<Preference>(
      `UPDATE preferences SET last_used_at = now()
       WHERE key = $1 AND status NOT IN ('deleted','superseded')
       RETURNING id, key, value, status, provenance, confidence, sensitivity, pinned,
                 created_at::text, updated_at::text, last_used_at::text, expires_at::text`,
      [key],
    );
    return rows[0] ?? null;
  }

  async search(query: string, limit = 20): Promise<Preference[]> {
    const { rows } = await this.pool.query<Preference>(
      `SELECT id, key, value, status, provenance, confidence, sensitivity, pinned,
              created_at::text, updated_at::text, last_used_at::text, expires_at::text
       FROM preferences
       WHERE status NOT IN ('deleted','superseded')
         AND (key ILIKE $1 OR value ILIKE $1)
       ORDER BY pinned DESC, updated_at DESC LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows;
  }

  async list(includeInactive = false): Promise<Preference[]> {
    const { rows } = await this.pool.query<Preference>(
      `SELECT id, key, value, status, provenance, confidence, sensitivity, pinned,
              created_at::text, updated_at::text, last_used_at::text, expires_at::text
       FROM preferences
       ${includeInactive ? "" : "WHERE status NOT IN ('deleted','superseded')"}
       ORDER BY pinned DESC, updated_at DESC`,
    );
    return rows;
  }

  /** Correct an existing preference's value (audited; keeps provenance trail). */
  async correct(key: string, value: string, provenance = "user correction"): Promise<Preference | null> {
    assertNotSecret(value);
    const current = await this.get(key);
    if (!current) return null;
    const updated = await this.remember({
      key,
      value,
      status: current.status,
      provenance,
      confidence: current.confidence,
      sensitivity: current.sensitivity,
    });
    await this.audit.append({
      actor: "user",
      event: "memory_correct",
      payload: { key, from: current.value, to: value },
    });
    return updated;
  }

  async pin(key: string, pinned: boolean): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE preferences SET pinned = $2, updated_at = now()
       WHERE key = $1 AND status NOT IN ('deleted','superseded')`,
      [key, pinned],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Soft-delete: excluded from retrieval immediately (R-MEM-04). */
  async delete(key: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE preferences SET status = 'deleted', updated_at = now()
       WHERE key = $1 AND status NOT IN ('deleted','superseded')`,
      [key],
    );
    if ((rowCount ?? 0) > 0) {
      await this.audit.append({ actor: "user", event: "memory_delete", payload: { key } });
      return true;
    }
    return false;
  }

  /** Physical purge of a deleted key's rows (right-to-be-forgotten). */
  async forget(key: string): Promise<number> {
    const { rowCount } = await this.pool.query(`DELETE FROM preferences WHERE key = $1`, [key]);
    await this.audit.append({ actor: "user", event: "memory_forget", payload: { key, purged: rowCount ?? 0 } });
    return rowCount ?? 0;
  }

  async export(): Promise<{ preferences: Preference[] }> {
    return { preferences: await this.list(true) };
  }
}
