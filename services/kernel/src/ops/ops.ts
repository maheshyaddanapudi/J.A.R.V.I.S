import { writeFile, readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { SettingsRegistry } from "../settings/registry.js";

/**
 * Longevity ops (D-0071) — the parts of "runs for years" verifiable at core:
 *  • health() — a self-diagnostic (DB latency, audit-chain integrity, memory
 *    sizes, a STALE-HEARTBEAT watchdog signal a supervisor uses to detect a
 *    wedged autonomy loop).
 *  • backup() — export the whole BRAIN (memory + settings + prompts + agenda +
 *    projects + grants) to a local file, sha256-manifested, so a crash or a bad
 *    migration is recoverable. Local-first (never leaves the machine).
 *  • restore() — load a backup into an EMPTY brain (refuses a non-empty target
 *    unless forced), for disaster recovery / migration to a new machine.
 * Cipher-at-rest is preserved: encrypted columns are exported AS STORED
 * (ciphertext), so a backup carries no plaintext and only the same vault can
 * read it back — the key never enters the backup.
 */

const BRAIN_TABLES = [
  "memory_entities", "memory_facts", "memory_relations", "memory_episodes",
  "conversation_memory", "preferences", "setting_specs", "runtime_settings",
  "prompts", "proactive_rules", "agenda_items", "projects", "project_log",
  "durable_grants", "reasoning_decisions",
];

export interface HealthReport {
  at: string;
  db: { ok: boolean; latencyMs: number };
  audit: { intact: boolean; entries: number };
  memory: { entities: number; facts: number; episodes: number; embeddings: number; conversationTurns: number };
  autonomy: { enabled: boolean; lastBeatAt: string | null; lastBeatAgeSec: number | null; stale: boolean };
  ok: boolean;
}

export class Ops {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly settings: SettingsRegistry,
    private readonly dataDir: string,
  ) {}

  private async count(sql: string): Promise<number> {
    try { const { rows } = await this.pool.query(sql); return Number(rows[0]?.count ?? 0); } catch { return 0; }
  }

  /** Self-diagnostic incl. the stale-heartbeat watchdog signal. */
  async health(): Promise<HealthReport> {
    const t0 = Date.now();
    let dbOk = true;
    try { await this.pool.query("SELECT 1"); } catch { dbOk = false; }
    const latencyMs = Date.now() - t0;
    const chain = await this.audit.verifyChain().catch(() => ({ intact: false, entries: 0 }));

    const memory = {
      entities: await this.count("SELECT count(*) FROM memory_entities WHERE status NOT IN ('deleted','superseded')"),
      facts: await this.count("SELECT count(*) FROM memory_facts WHERE status NOT IN ('deleted','superseded')"),
      episodes: await this.count("SELECT count(*) FROM memory_episodes WHERE status NOT IN ('deleted','superseded')"),
      embeddings: await this.count("SELECT count(*) FROM memory_embeddings"),
      conversationTurns: await this.count("SELECT count(*) FROM conversation_memory"),
    };

    const enabled = await this.settings.bool("autonomy.enabled", false);
    const interval = await this.settings.num("autonomy.intervalMinutes", 30);
    let lastBeatAt: string | null = null;
    try {
      const { rows } = await this.pool.query<{ at: string }>("SELECT at::text FROM heartbeats ORDER BY at DESC LIMIT 1");
      lastBeatAt = rows[0]?.at ?? null;
    } catch { /* table may not exist in a partial DB */ }
    const ageSec = lastBeatAt ? Math.round((Date.now() - Date.parse(lastBeatAt)) / 1000) : null;
    // WATCHDOG: autonomy is on but the last beat is older than 3× the interval → wedged.
    const stale = enabled && ageSec !== null && ageSec > interval * 60 * 3;

    return {
      at: new Date().toISOString(),
      db: { ok: dbOk, latencyMs },
      audit: { intact: chain.intact, entries: chain.entries },
      memory,
      autonomy: { enabled, lastBeatAt, lastBeatAgeSec: ageSec, stale },
      ok: dbOk && chain.intact && !stale,
    };
  }

  /** Export the brain to a local, sha256-manifested file (ciphertext preserved). */
  async backup(label = "manual"): Promise<{ path: string; sha256: string; rows: number; tables: Record<string, number> }> {
    const dump: Record<string, unknown[]> = {};
    const tableCounts: Record<string, number> = {};
    let total = 0;
    for (const t of BRAIN_TABLES) {
      try {
        const { rows } = await this.pool.query(`SELECT * FROM ${t}`);
        dump[t] = rows;
        tableCounts[t] = rows.length;
        total += rows.length;
      } catch { /* table absent in a partial DB — skip */ }
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const payload = JSON.stringify({ version: 1, at: new Date().toISOString(), label, tables: dump });
    const sha256 = createHash("sha256").update(payload).digest("hex");
    const path = join(this.dataDir, "backups", `brain-${stamp}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, payload, { mode: 0o600 });
    await this.audit.append({ actor: "user", event: "brain_backup", payload: { path, sha256, rows: total } });
    return { path, sha256, rows: total, tables: tableCounts };
  }

  /** Restore a backup into an EMPTY brain. Refuses a non-empty target unless forced. */
  async restore(path: string, opts?: { force?: boolean }): Promise<{ restored: number; tables: Record<string, number> }> {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as { version: number; tables: Record<string, Record<string, unknown>[]> };
    if (parsed.version !== 1) throw new Error(`unsupported backup version ${parsed.version}`);
    if (!opts?.force) {
      const existing = await this.count("SELECT count(*) FROM memory_entities");
      if (existing > 0) throw new Error("target brain is not empty — restore refuses to overwrite without force");
    }
    const client = await this.pool.connect();
    const tableCounts: Record<string, number> = {};
    let total = 0;
    try {
      await client.query("BEGIN");
      // restore in FK-safe order (entities before facts/relations; projects before log)
      for (const t of BRAIN_TABLES) {
        const rows = parsed.tables[t];
        if (!rows || !rows.length) continue;
        if (opts?.force) await client.query(`DELETE FROM ${t}`);
        for (const row of rows) {
          const cols = Object.keys(row);
          const vals = cols.map((c) => (row as Record<string, unknown>)[c]);
          const ph = cols.map((_, i) => `$${i + 1}`).join(",");
          await client.query(
            `INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
            vals,
          );
        }
        tableCounts[t] = rows.length;
        total += rows.length;
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    await this.audit.append({ actor: "user", event: "brain_restored", payload: { path, rows: total } });
    return { restored: total, tables: tableCounts };
  }
}
