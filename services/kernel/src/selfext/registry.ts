import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { CapabilityManifest } from "./protected.js";
import type { GuardVerdict } from "./guard.js";

/**
 * Capability registry (Z1). Records capability gaps and Stage-A-generated
 * capabilities. It has NO method that activates, installs, or runs a capability
 * — those states exist in the schema but there is deliberately no code path to
 * reach them until the dedicated security check-in builds Stage B (R-CAP-05/06).
 *
 * The registry is a protected path: generated code cannot modify it.
 */

export type CapabilityState =
  | "gap_recorded"
  | "stage_a_generated"
  | "scanned_clean"
  | "scanned_rejected"
  | "awaiting_review"
  | "approved"
  | "installed"
  | "active"
  | "rolled_back"
  | "disabled";

/** States this registry is ALLOWED to write. Activation states are excluded. */
const WRITABLE_STATES: CapabilityState[] = [
  "gap_recorded",
  "stage_a_generated",
  "scanned_clean",
  "scanned_rejected",
  "awaiting_review",
];

export class CapabilityRegistry {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
  ) {}

  /**
   * Pre-Phase-3 safe behavior (PRODUCT_SPEC §5.3): record a missing capability.
   * This NEVER claims J.A.R.V.I.S. can generate/install/activate it.
   */
  async recordGap(need: string, context: string, searchedExisting = false): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO capability_gaps (need, context, searched_existing)
       VALUES ($1,$2,$3) RETURNING id`,
      [need, context, searchedExisting],
    );
    await this.audit.append({
      actor: "kernel",
      event: "capability_gap_recorded",
      payload: { need, context },
    });
    return rows[0]!.id;
  }

  async listGaps(includeResolved = false): Promise<
    { id: string; need: string; context: string; recorded_at: string }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT id, need, context, recorded_at::text FROM capability_gaps
       ${includeResolved ? "" : "WHERE resolved = false"} ORDER BY recorded_at DESC`,
    );
    return rows;
  }

  /**
   * Record a Stage-A-generated capability + its guard verdict. State is derived
   * from the verdict — a rejected capability is 'scanned_rejected' and can never
   * advance; a clean one reaches 'awaiting_review' (the human check-in), NOT
   * 'approved'/'installed'/'active'.
   */
  async recordStageA(
    manifest: CapabilityManifest,
    verdict: GuardVerdict,
    provenance: Record<string, unknown>,
    report: Record<string, unknown>,
  ): Promise<{ id: string; state: CapabilityState }> {
    const state: CapabilityState =
      verdict.decision === "rejected" ? "scanned_rejected" : "awaiting_review";
    if (!WRITABLE_STATES.includes(state)) {
      throw new Error(`registry refuses to write non-Stage-A state '${state}'`);
    }
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO capabilities (name, version, state, risk_class, manifest_hash, permissions, provenance, report)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (name, version) DO UPDATE
         SET state = EXCLUDED.state, manifest_hash = EXCLUDED.manifest_hash,
             report = EXCLUDED.report, updated_at = now()
       RETURNING id`,
      [
        manifest.name,
        manifest.version,
        state,
        manifest.riskClass,
        verdict.manifestHash,
        manifest.permissions,
        JSON.stringify(provenance),
        JSON.stringify(report),
      ],
    );
    await this.audit.append({
      actor: "kernel",
      event: "capability_stage_a",
      payload: {
        name: manifest.name,
        version: manifest.version,
        state,
        manifestHash: verdict.manifestHash,
        decision: verdict.decision,
      },
    });
    return { id: rows[0]!.id, state };
  }

  async list(): Promise<
    { id: string; name: string; version: string; state: string; risk_class: string }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT id, name, version, state, risk_class FROM capabilities ORDER BY updated_at DESC`,
    );
    return rows;
  }

  async get(name: string, version: string): Promise<Record<string, unknown> | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM capabilities WHERE name=$1 AND version=$2`,
      [name, version],
    );
    return rows[0] ?? null;
  }
}
