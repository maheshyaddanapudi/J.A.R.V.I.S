import { createHash } from "node:crypto";
import type { AuditLog } from "../core/audit.js";
import {
  findHardLimitViolations,
  type CapabilityManifest,
  type GuardViolation,
} from "./protected.js";

/**
 * Capability guard (Z1). Runs the hard-limit check plus lightweight static
 * scans on a proposed generated capability and records the verdict in the audit
 * log. A capability that fails the hard limit can NEVER be generated further,
 * scanned-clean, approved, or installed — the guard's reject is terminal
 * (R-CAP-08).
 *
 * The guard NEVER activates anything. It only classifies a proposal as
 * clean/rejected and produces the evidence a human reviews at the dedicated
 * security check-in.
 */

export interface ScanFinding {
  severity: "reject" | "warn";
  kind: string;
  detail: string;
}

export interface GuardVerdict {
  capability: string;
  version: string;
  manifestHash: string;
  passedHardLimit: boolean;
  hardLimitViolations: GuardViolation[];
  findings: ScanFinding[];
  /** terminal decision: rejected proposals never advance */
  decision: "clean" | "rejected";
}

// Secret-shaped material must never be baked into generated code.
const SECRET_PATTERNS: [string, RegExp][] = [
  ["api_key", /\b(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16})\b/],
  ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["password_literal", /(password|passwd|secret)\s*[:=]\s*["'][^"']{6,}["']/i],
];

// Dangerous constructs that require human eyes even when not a hard-limit hit.
const DANGEROUS_PATTERNS: [string, RegExp][] = [
  ["dynamic_exec", /\b(eval|new Function|child_process|execSync|spawnSync)\b/],
  ["network_wildcard", /fetch\(\s*[`"']https?:\/\/\$/],
  ["fs_root_write", /writeFile\(\s*["']\/(?!Users|tmp|home)/],
];

export function manifestHash(manifest: CapabilityManifest): string {
  const canon = JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    riskClass: manifest.riskClass,
    permissions: [...manifest.permissions].sort(),
    files: manifest.files
      .map((f) => ({ path: f.path, op: f.op, sha: sha(f.content ?? "") }))
      .sort((a, b) => (a.path < b.path ? -1 : 1)),
  });
  return sha(canon);
}

export class CapabilityGuard {
  constructor(private readonly audit: AuditLog) {}

  async scan(manifest: CapabilityManifest): Promise<GuardVerdict> {
    const hardLimitViolations = findHardLimitViolations(manifest);
    const findings: ScanFinding[] = [];

    for (const file of manifest.files) {
      const content = file.content ?? "";
      for (const [kind, re] of SECRET_PATTERNS) {
        if (re.test(content)) {
          findings.push({ severity: "reject", kind: `secret:${kind}`, detail: file.path });
        }
      }
      for (const [kind, re] of DANGEROUS_PATTERNS) {
        if (re.test(content)) {
          findings.push({ severity: "warn", kind: `dangerous:${kind}`, detail: file.path });
        }
      }
    }

    const rejected =
      hardLimitViolations.length > 0 || findings.some((f) => f.severity === "reject");

    const verdict: GuardVerdict = {
      capability: manifest.name,
      version: manifest.version,
      manifestHash: manifestHash(manifest),
      passedHardLimit: hardLimitViolations.length === 0,
      hardLimitViolations,
      findings,
      decision: rejected ? "rejected" : "clean",
    };

    await this.audit.append({
      actor: "kernel",
      event: "capability_scan",
      payload: {
        capability: manifest.name,
        version: manifest.version,
        manifestHash: verdict.manifestHash,
        decision: verdict.decision,
        hardLimitViolations: hardLimitViolations.length,
        rejectFindings: findings.filter((f) => f.severity === "reject").length,
      },
    });

    return verdict;
  }
}

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
