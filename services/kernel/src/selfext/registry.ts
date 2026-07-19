import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { CapabilityManifest, CompositionStep } from "./protected.js";
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
    // Persist the executable composition (D-0073) so activation can reconstruct
    // + re-validate it later. A re-scan of a manifest whose state regresses back
    // to awaiting_review resets any prior activation timestamp (re-approval).
    const composition = manifest.composition ?? [];
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO capabilities (name, version, state, risk_class, manifest_hash, permissions, provenance, report, composition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (name, version) DO UPDATE
         SET state = EXCLUDED.state, manifest_hash = EXCLUDED.manifest_hash,
             report = EXCLUDED.report, permissions = EXCLUDED.permissions,
             risk_class = EXCLUDED.risk_class, composition = EXCLUDED.composition,
             activated_at = NULL, updated_at = now()
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
        JSON.stringify(composition),
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

  /**
   * The activation-relevant view of a stored capability (D-0073): its risk
   * class, requested permissions, and the executable composition — everything
   * the ActivationService needs to RE-VALIDATE the R-CAP-08 envelope before it
   * may run. Name-primary: `version` is optional (the user/J.A.R.V.I.S. refers
   * to a capability by name); an exact version is preferred, else the most
   * recently-updated row for that name. Returns null if the name is unknown.
   */
  async record(name: string, version?: string): Promise<CapabilityRecord | null> {
    const hydrate = (r: Record<string, unknown> | undefined): CapabilityRecord | null =>
      r
        ? {
            name: r.name as string,
            version: r.version as string,
            state: r.state as CapabilityState,
            riskClass: r.risk_class as CapabilityManifest["riskClass"],
            permissions: (r.permissions as string[]) ?? [],
            composition: normalizeComposition(r.composition),
            activatedAt: (r.activated_at as string) ?? null,
          }
        : null;
    if (version) {
      const exact = await this.pool.query(
        `SELECT name, version, state, risk_class, permissions, composition, activated_at::text
         FROM capabilities WHERE name=$1 AND version=$2`,
        [name, version],
      );
      if (exact.rows[0]) return hydrate(exact.rows[0]);
      // version was given but not found — fall through to latest-by-name so a
      // caller that guessed the version still resolves (activation re-validates).
    }
    const latest = await this.pool.query(
      `SELECT name, version, state, risk_class, permissions, composition, activated_at::text
       FROM capabilities WHERE name=$1 ORDER BY updated_at DESC LIMIT 1`,
      [name],
    );
    return hydrate(latest.rows[0]);
  }

  /** Currently ACTIVE capabilities (their tools should be live). */
  async listActive(): Promise<CapabilityRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT name, version, state, risk_class, permissions, composition, activated_at::text
       FROM capabilities WHERE state = 'active' ORDER BY activated_at ASC`,
    );
    return rows.map((r) => ({
      name: r.name,
      version: r.version,
      state: r.state,
      riskClass: r.risk_class,
      permissions: (r.permissions as string[]) ?? [],
      composition: normalizeComposition(r.composition),
      activatedAt: r.activated_at ?? null,
    }));
  }

  /**
   * Mark a capability ACTIVE (Stage-B, D-0073). This is the ONE registry method
   * that writes the 'active' state, and it is deliberately narrow: it refuses
   * unless the capability currently sits in an activatable state
   * (awaiting_review/approved/disabled). A 'scanned_rejected' capability can
   * NEVER be activated here — the hard-limit reject is terminal (R-CAP-08).
   * The caller (ActivationService) has already re-validated the envelope.
   */
  async markActivated(name: string, version: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE capabilities SET state = 'active', activated_at = now(), updated_at = now()
       WHERE name = $1 AND version = $2
         AND state IN ('awaiting_review','approved','disabled')`,
      [name, version],
    );
    const ok = (rowCount ?? 0) > 0;
    if (ok) {
      await this.audit.append({
        actor: "kernel",
        event: "capability_activated",
        payload: { name, version },
      });
    }
    return ok;
  }

  /** Deactivate an active capability (its tools are unregistered by the caller). */
  async markDeactivated(name: string, version: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE capabilities SET state = 'disabled', updated_at = now()
       WHERE name = $1 AND version = $2 AND state = 'active'`,
      [name, version],
    );
    const ok = (rowCount ?? 0) > 0;
    if (ok) {
      await this.audit.append({
        actor: "kernel",
        event: "capability_deactivated",
        payload: { name, version },
      });
    }
    return ok;
  }
}

/** Activation-relevant view of a stored capability. */
export interface CapabilityRecord {
  name: string;
  version: string;
  state: CapabilityState;
  riskClass: CapabilityManifest["riskClass"];
  permissions: string[];
  composition: CompositionStep[];
  activatedAt: string | null;
}

/** jsonb may arrive parsed (pg) or as a string; coerce to a step array safely. */
function normalizeComposition(raw: unknown): CompositionStep[] {
  let v = raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is CompositionStep => !!s && typeof (s as CompositionStep).tool === "string");
}
