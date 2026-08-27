/**
 * SELF-EXTENSION HARD LIMIT (R-CAP-08, THREAT_MODEL T3) — PROTECTED PATH itself.
 *
 * The non-negotiable structural enforcement: NO generated capability may ever
 * create, alter, or bypass security policy, approval policy, audit logging,
 * emergency-stop controls, credential storage, sandbox enforcement,
 * permission-escalation logic, or the capability-installer security itself.
 *
 * This is enforced deny-first at generation AND at (future, check-in-gated)
 * install time by scanning the proposed capability's file set + permission
 * manifest. A single touch of a protected path or protected permission is a
 * hard reject — never a warning, never overridable by the capability's own
 * content, tests, or manifest.
 *
 * This module lives inside the Z1 trust core; generated code can never modify it.
 */

/** Repo paths a generated capability may NEVER create, modify, or delete. */
export const PROTECTED_PATHS: readonly string[] = [
  "services/kernel/src/core/", // policy, approval, audit, e-stop, loop, tools registry
  "services/kernel/src/crypto/", // vault, KEK, credential storage
  "services/kernel/src/selfext/protected.ts", // this enforcement itself
  "services/kernel/src/selfext/guard.ts",
  "services/kernel/src/selfext/registry.ts",
  "services/kernel/src/db/migrations/", // schema, incl. audit/estop tables
  "services/kernel/src/config.ts",
  "infra/", // compose, infra config
  ".github/", // CI / supply chain
];

/** Permission-manifest scopes a generated capability may NEVER request. */
export const PROTECTED_PERMISSIONS: readonly string[] = [
  "policy:write",
  "policy:bypass",
  "approval:bypass",
  "approval:grant",
  "audit:write",
  "audit:disable",
  "estop:disable",
  "estop:override",
  "credential:read",
  "credential:write",
  "vault:read",
  "vault:write",
  "sandbox:disable",
  "sandbox:escape",
  "capability:install", // only the Z1 installer may install
  "capability:activate",
  "permission:escalate",
];

/** Content patterns that indicate an attempt to reach protected internals. */
const PROTECTED_SYMBOL_PATTERNS: readonly RegExp[] = [
  /\bAuditLog\b/,
  /\bEmergencyStop\b/,
  /\bPolicyEngine\b/,
  /\bApprovalBroker\b/,
  /\bVault\b/,
  /\bresolveKek\b/,
  /\bPROTECTED_(PATHS|PERMISSIONS)\b/,
  /\bpg_advisory_xact_lock\b.*audit/i,
  /process\.env\.JARVIS_MASTER_KEY/,
  /\bDROP\s+TABLE\b/i,
  /\bestop\b.*\b(update|delete|set)\b/i,
];

export interface ProposedFile {
  path: string; // repo-relative target path
  op: "create" | "modify" | "delete";
  content?: string; // for create/modify
}

/** One step of an activatable capability: invoke an EXISTING gated tool. Stage-B
 *  capabilities are compositions of these — never raw code — so an activated
 *  capability can only do what the user could already do through gated tools. */
export interface CompositionStep {
  tool: string;                       // must be an already-registered gated tool
  args?: Record<string, unknown>;     // static args (merged with call-time args)
  note?: string;
}

export interface CapabilityManifest {
  name: string;
  version: string;
  riskClass: "READ_ONLY" | "LOW_REVERSIBLE" | "CONSEQUENTIAL" | "HIGH_RISK_PHYSICAL";
  permissions: string[];
  files: ProposedFile[];
  /** Stage-B executable form: a composition of existing gated tools (optional). */
  composition?: CompositionStep[];
}

/** Tool-name prefixes a composition may NEVER call (privilege / recursion / the
 *  self-extension machinery itself). Structural guard for Stage-B activation. */
export const COMPOSITION_TOOL_DENYLIST: readonly string[] = [
  "selfext.", "capability:", "settings.register", "gateway.route",
];


export interface GuardViolation {
  kind: "protected_path" | "protected_permission" | "protected_symbol" | "protected_composition";
  detail: string;
}

/** Returns every hard-limit violation in a proposed capability (empty = clean). */
export function findHardLimitViolations(manifest: CapabilityManifest): GuardViolation[] {
  const violations: GuardViolation[] = [];

  for (const file of manifest.files) {
    const normalized = file.path.replace(/^\.?\/+/, "");
    for (const prot of PROTECTED_PATHS) {
      if (normalized === prot || normalized.startsWith(prot)) {
        violations.push({
          kind: "protected_path",
          detail: `${file.op} of protected path '${file.path}' (matches '${prot}')`,
        });
      }
    }
    // path traversal attempts
    if (normalized.includes("..")) {
      violations.push({ kind: "protected_path", detail: `path traversal in '${file.path}'` });
    }
    if (file.content) {
      for (const re of PROTECTED_SYMBOL_PATTERNS) {
        if (re.test(file.content)) {
          violations.push({
            kind: "protected_symbol",
            detail: `file '${file.path}' references protected internal (${re.source})`,
          });
        }
      }
    }
  }

  for (const perm of manifest.permissions) {
    if (PROTECTED_PERMISSIONS.includes(perm)) {
      violations.push({
        kind: "protected_permission",
        detail: `requests protected permission '${perm}'`,
      });
    }
  }

  // Stage-B compositions are part of the hard limit too (deny-first): a
  // composition step may never call the self-extension machinery, another
  // capability, or a privilege-bearing tool prefix. (Activation re-checks this;
  // here it is rejected TERMINALLY at Stage A.)
  for (const step of manifest.composition ?? []) {
    if (typeof step.tool !== "string" || !step.tool.trim()) {
      violations.push({ kind: "protected_composition", detail: "composition step missing a tool name" });
      continue;
    }
    for (const prefix of COMPOSITION_TOOL_DENYLIST) {
      if (step.tool.startsWith(prefix)) {
        violations.push({
          kind: "protected_composition",
          detail: `composition calls denylisted tool '${step.tool}' (matches '${prefix}')`,
        });
      }
    }
  }

  return violations;
}

/** True when the capability is safe against the hard limit. */
export function passesHardLimit(manifest: CapabilityManifest): boolean {
  return findHardLimitViolations(manifest).length === 0;
}
