import type pg from "pg";
import { pingDatabase } from "../db/pool.js";
import { migrationStatus } from "../db/migrate.js";

/**
 * Health report = only real, measured state (honesty rule R-CORE-02).
 * Every field is computed at request time; nothing is hardcoded "green".
 */
export interface HealthReport {
  status: "ok" | "degraded";
  service: "kernel";
  version: string;
  env: string;
  uptimeSeconds: number;
  now: string;
  checks: {
    database:
      | { ok: true; latencyMs: number }
      | { ok: false; error: string };
    migrations:
      | { ok: true; total: number; applied: number }
      | { ok: false; pending: string[]; error?: string };
  };
}

export async function buildHealthReport(opts: {
  pool: pg.Pool;
  migrationsDir: string;
  version: string;
  env: string;
  startedAt: number;
}): Promise<HealthReport> {
  const database = await pingDatabase(opts.pool);

  let migrations: HealthReport["checks"]["migrations"];
  if (!database.ok) {
    migrations = { ok: false, pending: [], error: "database unreachable" };
  } else {
    try {
      const status = await migrationStatus(opts.pool, opts.migrationsDir);
      migrations =
        status.pending.length === 0
          ? { ok: true, total: status.total, applied: status.applied }
          : { ok: false, pending: status.pending };
    } catch (err) {
      migrations = {
        ok: false,
        pending: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const allOk = database.ok && migrations.ok;
  return {
    status: allOk ? "ok" : "degraded",
    service: "kernel",
    version: opts.version,
    env: opts.env,
    uptimeSeconds: Math.round((Date.now() - opts.startedAt) / 1000),
    now: new Date().toISOString(),
    checks: { database, migrations },
  };
}
