import pg from "pg";

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/** Round-trip check used by /health — returns measured latency, never a canned value. */
export async function pingDatabase(
  pool: pg.Pool,
): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const start = process.hrtime.bigint();
  try {
    await pool.query("SELECT 1");
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
