import type { AuditLog } from "../core/audit.js";
import { CapabilityGuard, type GuardVerdict } from "./guard.js";
import { CapabilityRegistry } from "./registry.js";
import type { CapabilityManifest } from "./protected.js";

/**
 * Stage A — GENERATION WITHOUT ACTIVATION (R-CAP-04).
 *
 * Detect gap → search existing → define typed contract + permission manifest +
 * risk → (generation happens in an isolated worktree, out of process) → guard
 * scan (hard limit + secret/danger scans) → produce a human-readable capability
 * report + verdict. Records to the registry as 'awaiting_review' (clean) or
 * 'scanned_rejected'.
 *
 * IT NEVER INSTALLS, ACTIVATES, OR RUNS THE CAPABILITY. There is deliberately no
 * method here (or anywhere yet) that does. Stage B — controlled activation —
 * is built only AFTER the dedicated security check-in (D-0023, R-CAP-05).
 *
 * This module orchestrates the pipeline; the actual code generation is done by
 * an out-of-process sandboxed generator (a subagent in an isolated git
 * worktree). Here we accept its proposed manifest and gate it.
 */

export interface StageAReport {
  capability: string;
  version: string;
  riskClass: string;
  permissions: string[];
  summary: string;
  fileCount: number;
  verdict: GuardVerdict;
  /** always false — Stage A never activates */
  activated: false;
  /** the required next step, surfaced for the human */
  nextStep: string;
}

export class StageAPipeline {
  private guard: CapabilityGuard;

  constructor(
    private readonly registry: CapabilityRegistry,
    audit: AuditLog,
  ) {
    this.guard = new CapabilityGuard(audit);
  }

  /**
   * Run Stage A on a proposed capability manifest (produced by the sandboxed
   * generator). Returns the report + verdict. Records to the registry.
   */
  async run(
    manifest: CapabilityManifest,
    opts: { need: string; context: string; sources?: string[] },
  ): Promise<StageAReport> {
    const verdict = await this.guard.scan(manifest);

    const report: StageAReport = {
      capability: manifest.name,
      version: manifest.version,
      riskClass: manifest.riskClass,
      permissions: manifest.permissions,
      summary:
        verdict.decision === "rejected"
          ? `REJECTED by the hard limit / scans — will NOT advance. ${verdict.hardLimitViolations
              .map((v) => v.detail)
              .join("; ")}`
          : `Generated ${manifest.files.length} file(s), passed the hard limit and scans. Awaiting the security check-in before any activation path exists.`,
      fileCount: manifest.files.length,
      verdict,
      activated: false,
      nextStep:
        verdict.decision === "rejected"
          ? "Discard: a capability that fails the hard limit can never be installed (R-CAP-08)."
          : "Dedicated security check-in (R-CAP-05) — no Stage B activation path is built until then.",
    };

    await this.registry.recordStageA(
      manifest,
      verdict,
      { need: opts.need, context: opts.context, sources: opts.sources ?? [] },
      report as unknown as Record<string, unknown>,
    );

    return report;
  }
}
