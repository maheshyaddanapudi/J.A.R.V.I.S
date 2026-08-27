import type { AuditLog } from "./audit.js";
import type { EmergencyStop } from "./estop.js";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Policy engine. Evaluation order is fixed and non-negotiable (PRODUCT_SPEC §6,
 * THREAT_MODEL §5):
 *   1. emergency stop        (engaged => everything denied)
 *   2. PROHIBITED list       (hard deny, deny-first, before anything else)
 *   3. risk classification   (unclassified => CONSEQUENTIAL)
 *   4. scope check           (grant must cover tool × resource)
 *   5. approval state        (consequential/high-risk => needs approval)
 *   6. rate / budget limits  (arrives with proactivity, Phase 4)
 * The MODEL never makes this decision — the policy engine does.
 */

export type RiskClass =
  | "READ_ONLY"
  | "LOW_REVERSIBLE"
  | "CONSEQUENTIAL"
  | "HIGH_RISK_PHYSICAL";

export type Decision =
  | { effect: "allow"; auto: true; reason: string }
  | { effect: "needs_approval"; riskClass: RiskClass; reason: string }
  | { effect: "deny"; reason: string; prohibited?: boolean };

export interface ActionRequest {
  tool: string;
  /** semantic action verb, matched against the prohibited list (not just tool name) */
  action: string;
  riskClass?: RiskClass;
  resourceScope?: string; // e.g. 'file:/Users/me/workspace/**', 'domain:example.com'
  /** grant tokens held for this task/session */
  grants?: Grant[];
  /** true when the user has explicitly delegated automatic low-risk actions this task */
  delegatedAutomation?: boolean;
  reason: string;
  source: string;
}

export interface Grant {
  tool: string; // '*' = any tool
  scope: string; // '*' = any resource
  riskCeiling: RiskClass;
  kind: "allow-once" | "allow-for-task" | "allow-for-session" | "always-allow-in-scope";
}

/**
 * PROHIBITED list (R-AUTO-04). Matched on ACTION SEMANTICS, not tool names.
 * These are refused before any grant, approval, or delegation can apply.
 */
const PROHIBITED: { id: string; test: RegExp }[] = [
  { id: "autonomous_weapons", test: /\b(weapon|munition|fire.?control|targeting.system|launch.(missile|strike))\b/i },
  { id: "unauthorized_access", test: /\b(hack|exploit|brute.?force|crack.(password|credential)|bypass.(auth|access.control|login)|privilege.escalat)\b/i },
  { id: "covert_surveillance", test: /\b(covert|surveil|spy|hidden.(camera|mic|recording)|stalk|track.person)\b/i },
  { id: "credential_theft", test: /\b(steal|exfiltrat|dump).{0,20}(credential|password|token|secret|key)\b/i },
  { id: "malware", test: /\b(malware|ransomware|keylogger|rootkit|trojan|hidden.persistence|backdoor)\b/i },
  { id: "disable_safety", test: /\b(disable|bypass|remove).{0,20}(safety|approval|audit|emergency.stop|e-?stop|sandbox|policy)\b/i },
  { id: "undisclosed_impersonation", test: /\b(impersonate|pretend.to.be|pose.as).{0,20}(the.user|owner|me)\b/i },
  { id: "unauthorized_transaction", test: /\b(unauthoriz|without.approval).{0,20}(purchase|payment|transfer|buy|send.money)\b/i },
];

export class PolicyEngine {
  constructor(
    private readonly audit: AuditLog,
    private readonly estop: EmergencyStop,
  ) {}

  /** Pure classification — no side effects; used by evaluate() and testable alone. */
  classify(req: ActionRequest): Decision {
    if (this.estop.isEngaged) {
      return { effect: "deny", reason: "emergency stop engaged" };
    }

    const haystack = `${req.tool} ${req.action} ${req.reason}`;
    for (const rule of PROHIBITED) {
      if (rule.test.test(haystack)) {
        return { effect: "deny", reason: `prohibited: ${rule.id}`, prohibited: true };
      }
    }

    const risk = req.riskClass ?? "CONSEQUENTIAL"; // unclassified defaults to consequential

    if (risk === "READ_ONLY") {
      return { effect: "allow", auto: true, reason: "read-only inspection" };
    }

    const covered = (req.grants ?? []).some(
      (g) =>
        (g.tool === "*" || g.tool === req.tool) &&
        (g.scope === "*" || (req.resourceScope ?? "").startsWith(g.scope.replace(/\*+$/, ""))) &&
        riskAtOrBelow(risk, g.riskCeiling),
    );
    if (covered) {
      return { effect: "allow", auto: true, reason: "covered by active grant" };
    }

    if (risk === "LOW_REVERSIBLE" && req.delegatedAutomation) {
      return { effect: "allow", auto: true, reason: "low-risk reversible, automation delegated" };
    }

    return {
      effect: "needs_approval",
      riskClass: risk,
      reason:
        risk === "HIGH_RISK_PHYSICAL"
          ? "high-risk physical: explicit per-action approval + hardware interlock required"
          : "consequential action requires approval",
    };
  }

  /** Classify + audit the decision. */
  async evaluate(req: ActionRequest): Promise<Decision> {
    const decision = this.classify(req);
    await this.audit.append({
      actor: "kernel",
      event: "policy_decision",
      payload: {
        tool: req.tool,
        action: req.action,
        resourceScope: req.resourceScope ?? null,
        source: req.source,
        decision: decision.effect,
        reason: decision.reason,
        ...(decision.effect === "deny" && decision.prohibited ? { prohibited: true } : {}),
      },
    });
    return decision;
  }
}

const ORDER: RiskClass[] = [
  "READ_ONLY",
  "LOW_REVERSIBLE",
  "CONSEQUENTIAL",
  "HIGH_RISK_PHYSICAL",
];
function riskAtOrBelow(risk: RiskClass, ceiling: RiskClass): boolean {
  return ORDER.indexOf(risk) <= ORDER.indexOf(ceiling);
}
