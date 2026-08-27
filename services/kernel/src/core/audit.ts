import { createHash } from "node:crypto";
import type pg from "pg";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 * Generated capabilities may never modify anything under src/core/.
 *
 * Append-only hash-chained audit writer. Every consequential kernel event goes
 * through here; chain verification detects any tampering (THREAT_MODEL T11).
 */

const WHOLE_MATCH_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g, // API-key-shaped tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const KEY_VALUE_PATTERN =
  /((?:password|passwd|secret|token|api_key|apikey)["']?\s*[:=]\s*["']?)[^"'\s,}]{4,}/gi;

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of WHOLE_MATCH_PATTERNS) out = out.replace(re, "<REDACTED>");
  out = out.replace(KEY_VALUE_PATTERN, "$1<REDACTED>");
  return out;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

export interface AuditEntry {
  actor: string;
  event: string;
  payload: Record<string, unknown>;
}

export class AuditLog {
  constructor(private readonly pool: pg.Pool) {}

  /** Append one entry; serialized via advisory lock so the chain never forks. */
  async append(entry: AuditEntry): Promise<{ seq: number; chainHash: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('audit_log_chain'))");
      const prev = await client.query<{ chain_hash: string }>(
        "SELECT chain_hash FROM audit_log ORDER BY seq DESC LIMIT 1",
      );
      const prevHash = prev.rows[0]?.chain_hash ?? "genesis";
      const payload = JSON.parse(redactSecrets(JSON.stringify(entry.payload))) as Record<
        string,
        unknown
      >;
      const body = canonicalJson({ actor: entry.actor, event: entry.event, payload });
      const chainHash = createHash("sha256").update(prevHash).update(body).digest("hex");
      const inserted = await client.query<{ seq: string }>(
        `INSERT INTO audit_log (actor, event, payload, prev_hash, chain_hash)
         VALUES ($1,$2,$3,$4,$5) RETURNING seq`,
        [entry.actor, entry.event, JSON.stringify(payload), prevHash, chainHash],
      );
      await client.query("COMMIT");
      return { seq: Number(inserted.rows[0]!.seq), chainHash };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Walk the full chain; returns first broken seq or null when intact. */
  async verifyChain(): Promise<{ intact: boolean; brokenAtSeq: number | null; entries: number }> {
    const { rows } = await this.pool.query<{
      seq: string;
      actor: string;
      event: string;
      payload: Record<string, unknown>;
      prev_hash: string;
      chain_hash: string;
    }>("SELECT seq, actor, event, payload, prev_hash, chain_hash FROM audit_log ORDER BY seq");
    let prevHash = "genesis";
    for (const row of rows) {
      const body = canonicalJson({ actor: row.actor, event: row.event, payload: row.payload });
      const expected = createHash("sha256").update(prevHash).update(body).digest("hex");
      if (row.prev_hash !== prevHash || row.chain_hash !== expected) {
        return { intact: false, brokenAtSeq: Number(row.seq), entries: rows.length };
      }
      prevHash = row.chain_hash;
    }
    return { intact: true, brokenAtSeq: null, entries: rows.length };
  }

  async recent(limit = 100): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      "SELECT seq, at, actor, event, payload, chain_hash FROM audit_log ORDER BY seq DESC LIMIT $1",
      [limit],
    );
    return rows;
  }
}
