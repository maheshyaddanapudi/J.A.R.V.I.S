import type pg from "pg";
import type { AuditLog } from "./audit.js";
import type { Grant, RiskClass } from "./policy.js";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Durable consent store (D-0059): persists "always-allow-in-scope" grants so a
 * standing decision survives a restart. Written only by the approval path.
 * Listable + revocable — a standing consent is always visible and reversible.
 */
export interface DurableGrantRow {
  id: string;
  tool: string;
  scope: string;
  riskCeiling: RiskClass;
  createdAt: string;
}

export class DurableGrants {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
  ) {}

  /** Persist a standing grant (idempotent per tool+scope). */
  async remember(tool: string, scope: string, riskCeiling: RiskClass): Promise<void> {
    await this.pool.query(
      `INSERT INTO durable_grants (tool, scope, risk_ceiling) VALUES ($1,$2,$3)
       ON CONFLICT (tool, scope) DO UPDATE SET risk_ceiling = EXCLUDED.risk_ceiling`,
      [tool, scope, riskCeiling],
    );
    await this.audit.append({ actor: "user", event: "durable_grant_set", payload: { tool, scope } });
  }

  /** Hydrate the loop at startup: durable grants become active session grants. */
  async load(): Promise<Grant[]> {
    try {
      const { rows } = await this.pool.query<{ tool: string; scope: string; risk_ceiling: string }>(
        `SELECT tool, scope, risk_ceiling FROM durable_grants`,
      );
      return rows.map((r) => ({
        tool: r.tool,
        scope: r.scope,
        riskCeiling: r.risk_ceiling as RiskClass,
        kind: "always-allow-in-scope" as const,
      }));
    } catch {
      return []; // absence of the table/grants must never block boot
    }
  }

  async list(): Promise<DurableGrantRow[]> {
    const { rows } = await this.pool.query<{
      id: string; tool: string; scope: string; risk_ceiling: string; created_at: string;
    }>(`SELECT id, tool, scope, risk_ceiling, created_at::text FROM durable_grants ORDER BY created_at DESC`);
    return rows.map((r) => ({
      id: r.id, tool: r.tool, scope: r.scope,
      riskCeiling: r.risk_ceiling as RiskClass, createdAt: r.created_at,
    }));
  }

  async revoke(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM durable_grants WHERE id = $1`, [id]);
    if (rowCount) await this.audit.append({ actor: "user", event: "durable_grant_revoked", payload: { id } });
    return Boolean(rowCount);
  }
}
