import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";

/**
 * Minimal deterministic SQL migration runner.
 *
 * - Files: src/db/migrations/NNNN_name.sql, applied in filename order.
 * - Each applied migration's SHA-256 is recorded; a changed historical file is
 *   a hard error (migrations are immutable once applied) — tamper-evident by
 *   design, consistent with the audit posture (R-SEC-03).
 * - Each migration runs in its own transaction.
 */

export interface AppliedMigration {
  filename: string;
  sha256: string;
  applied_at: string;
}

export async function listMigrationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
}

export async function runMigrations(
  pool: pg.Pool,
  dir: string,
): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      sha256     text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = await listMigrationFiles(dir);
  const { rows: existing } = await pool.query<AppliedMigration>(
    "SELECT filename, sha256, applied_at::text FROM schema_migrations ORDER BY filename",
  );
  const existingByName = new Map(existing.map((m) => [m.filename, m]));

  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const filename of files) {
    const sql = await readFile(join(dir, filename), "utf8");
    const sha256 = createHash("sha256").update(sql).digest("hex");
    const prior = existingByName.get(filename);

    if (prior) {
      if (prior.sha256 !== sha256) {
        throw new Error(
          `Migration ${filename} changed after being applied (recorded ${prior.sha256}, on disk ${sha256}). Migrations are immutable.`,
        );
      }
      alreadyApplied.push(filename);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename, sha256) VALUES ($1, $2)",
        [filename, sha256],
      );
      await client.query("COMMIT");
      applied.push(filename);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(
        `Migration ${filename} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      client.release();
    }
  }

  return { applied, alreadyApplied };
}

export async function migrationStatus(
  pool: pg.Pool,
  dir: string,
): Promise<{ total: number; applied: number; pending: string[] }> {
  const files = await listMigrationFiles(dir);
  let appliedNames = new Set<string>();
  try {
    const { rows } = await pool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations",
    );
    appliedNames = new Set(rows.map((r) => r.filename));
  } catch {
    // schema_migrations doesn't exist yet — nothing applied.
  }
  const pending = files.filter((f) => !appliedNames.has(f));
  return { total: files.length, applied: files.length - pending.length, pending };
}
