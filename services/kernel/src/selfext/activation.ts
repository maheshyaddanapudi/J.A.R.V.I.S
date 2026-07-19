import type { AuditLog } from "../core/audit.js";
import { redactSecrets } from "../core/audit.js";
import type { RiskClass } from "../core/policy.js";
import type { Tool, ToolRegistry, ToolResult } from "../core/tools.js";
import type { CapabilityRegistry, CapabilityRecord } from "./registry.js";
import type { StageAPipeline } from "./stageA.js";
import {
  COMPOSITION_TOOL_DENYLIST,
  findHardLimitViolations,
  type CapabilityManifest,
  type CompositionStep,
} from "./protected.js";

/**
 * Stage B — CONTROLLED ACTIVATION (D-0073, R-CAP-05).
 *
 * A Stage-A-generated capability, once the user approves, is activated as a
 * `capability:<name>` gated tool whose body is a COMPOSITION of already-existing
 * gated tools — never executed manifest code, never an imported module, never a
 * reach into Z1. It can therefore only ever do what the user could already do
 * through the gated loop; each composed step still passes policy → approval →
 * audit independently. This is the same safe-by-construction pattern as A2UI and
 * skills, extended to capabilities.
 *
 * The non-negotiable R-CAP-08 envelope is UNCHANGED and RE-VALIDATED here:
 *   • a 'scanned_rejected' capability can never activate (registry refuses it);
 *   • requested permissions are re-scanned against PROTECTED_PERMISSIONS;
 *   • every composition step must resolve to a real, registered tool that is NOT
 *     in COMPOSITION_TOOL_DENYLIST (no selfext.*, no capability:*, no
 *     settings.register, no gateway.route — no privilege, recursion, or
 *     self-activation);
 *   • the composed capability tool carries a risk ceiling >= every step's risk,
 *     so the outer gate is never weaker than an inner step.
 *
 * Activation itself is driven only through the CONSEQUENTIAL `selfext.activate`
 * tool (human approval through any interface); deactivation is always available.
 */

const RISK_ORDER: Record<RiskClass, number> = {
  READ_ONLY: 0,
  LOW_REVERSIBLE: 1,
  CONSEQUENTIAL: 2,
  HIGH_RISK_PHYSICAL: 3,
};

/** The subset of the core loop the composition executor needs. */
export interface StepRunner {
  runTool(input: {
    tool: string;
    args: unknown;
    source: string;
  }): Promise<{ ok: boolean; summary: string; denied?: boolean; detail?: string }>;
}

export interface ActivationCheck {
  ok: boolean;
  reasons: string[];
}

export class ActivationService {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly tools: ToolRegistry,
    private readonly runner: StepRunner,
    private readonly audit: AuditLog,
  ) {}

  /**
   * Re-validate the R-CAP-08 envelope for a stored capability against the LIVE
   * tool registry. Pure/side-effect-free — returns every reason it may not
   * activate (empty reasons ⇒ safe).
   */
  validate(rec: CapabilityRecord): ActivationCheck {
    const reasons: string[] = [];

    // A terminally-rejected capability can never activate.
    if (rec.state === "scanned_rejected") {
      reasons.push("capability was rejected by the Stage-A hard-limit scan (terminal)");
    }

    // Re-scan requested permissions against the protected list (files were
    // scanned at Stage A; permissions are re-checked here at activation time).
    const permViolations = findHardLimitViolations({
      name: rec.name,
      version: rec.version,
      riskClass: rec.riskClass,
      permissions: rec.permissions,
      files: [],
    });
    for (const v of permViolations) reasons.push(v.detail);

    // A capability with no composition has nothing safe to run.
    if (!rec.composition.length) {
      reasons.push("no executable composition — nothing to activate");
    }

    for (const step of rec.composition) {
      if (typeof step.tool !== "string" || !step.tool.trim()) {
        reasons.push("composition step is missing a tool name");
        continue;
      }
      if (COMPOSITION_TOOL_DENYLIST.some((p) => step.tool.startsWith(p))) {
        reasons.push(`composition may not call '${step.tool}' (denylisted: privilege/recursion/self-activation)`);
        continue;
      }
      if (!this.tools.has(step.tool)) {
        reasons.push(`composition references unknown tool '${step.tool}'`);
      }
    }

    return { ok: reasons.length === 0, reasons };
  }

  /** The effective risk ceiling of a capability = max(declared, every step). */
  private ceiling(rec: CapabilityRecord): RiskClass {
    let max = RISK_ORDER[rec.riskClass] ?? 1;
    for (const step of rec.composition) {
      const t = this.tools.get(step.tool);
      if (t) max = Math.max(max, RISK_ORDER[t.riskClass] ?? 1);
    }
    return (Object.keys(RISK_ORDER) as RiskClass[]).find((k) => RISK_ORDER[k] === max) ?? "CONSEQUENTIAL";
  }

  /** Build the gated `capability:<name>` tool that runs the composition. */
  private buildTool(rec: CapabilityRecord): Tool {
    const toolName = `capability:${rec.name}`;
    const risk = this.ceiling(rec);
    const steps = rec.composition;
    const runner = this.runner;
    const summary = steps.map((s) => s.tool).join(" → ");
    return {
      name: toolName,
      description:
        `Activated capability "${rec.name}" v${rec.version} (D-0073). Runs a fixed, ` +
        `pre-approved composition of existing gated tools: ${summary}. Each step still ` +
        `passes policy/approval/audit independently.`,
      riskClass: risk,
      action: `run capability ${rec.name}`,
      inputSchema: { type: "object", properties: {}, additionalProperties: true },
      ...(risk === "CONSEQUENTIAL" || risk === "HIGH_RISK_PHYSICAL"
        ? {
            disclose: () => ({
              whatWillHappen: `Run activated capability "${rec.name}" — ${steps.length} composed gated step(s).`,
              affected: steps.map((s) => `${s.tool}${s.note ? ` (${s.note})` : ""}`),
              proposedCommands: steps.map((s) => s.tool),
              reason: `Composed capability "${rec.name}" v${rec.version}.`,
              riskClass: risk,
              reversible: false,
              rollbackPlan: "Each composed step captures its own rollback where reversible; deactivate the capability to remove it.",
            }),
          }
        : {}),
      async run(callArgs: unknown): Promise<ToolResult> {
        const outcomes: { tool: string; ok: boolean; summary: string }[] = [];
        const call = (callArgs ?? {}) as Record<string, unknown>;
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
          // Step args are authoritative (the declared, validated composition);
          // call-time args only fill placeholders the composition left open.
          const args = { ...call, ...(step.args ?? {}) };
          const r = await runner.runTool({ tool: step.tool, args, source: toolName });
          outcomes.push({ tool: step.tool, ok: r.ok, summary: r.summary });
          if (!r.ok || r.denied) {
            return {
              ok: false,
              summary: `capability "${rec.name}" halted at step ${i + 1}/${steps.length} (${step.tool}): ${r.summary}`,
              data: { outcomes },
            };
          }
        }
        return {
          ok: true,
          summary: `capability "${rec.name}" ran ${steps.length} step(s) successfully`,
          data: { outcomes },
          detail: outcomes.map((o, i) => `${i + 1}. ${o.tool}: ${o.summary}`).join("\n"),
        };
      },
    };
  }

  /**
   * Activate a capability: re-validate the envelope, mark it active in the
   * registry, and register its `capability:<name>` tool live. Refuses (without
   * side effects) if validation fails or the registry won't transition the
   * state. The CONSEQUENTIAL `selfext.activate` tool is the only caller that
   * reaches here in normal operation, so human approval has already happened.
   */
  async activate(name: string, version?: string): Promise<{ ok: boolean; tool?: string; reasons?: string[] }> {
    const rec = await this.registry.record(name, version);
    if (!rec) return { ok: false, reasons: [`no such capability ${name}`] };
    const check = this.validate(rec);
    if (!check.ok) {
      await this.audit.append({
        actor: "kernel",
        event: "capability_activation_refused",
        payload: { name: rec.name, version: rec.version, reasons: check.reasons },
      });
      return { ok: false, reasons: check.reasons };
    }
    const marked = await this.registry.markActivated(rec.name, rec.version);
    if (!marked) {
      return { ok: false, reasons: [`registry refused to activate ${rec.name} (state '${rec.state}')`] };
    }
    this.tools.register(this.buildTool(rec));
    return { ok: true, tool: `capability:${rec.name}` };
  }

  /** Deactivate a capability: unregister its tool + mark it disabled. */
  async deactivate(name: string, version?: string): Promise<boolean> {
    const rec = await this.registry.record(name, version);
    if (!rec) return false;
    const marked = await this.registry.markDeactivated(rec.name, rec.version);
    this.tools.unregister(`capability:${rec.name}`);
    return marked;
  }

  /**
   * Re-register the tools of every capability that was active before a restart
   * (durable activation). Each is RE-VALIDATED against the current registry; one
   * that no longer passes (e.g. a composed tool was removed) is skipped and
   * logged, never crashing boot.
   */
  async restoreActive(): Promise<{ restored: number; skipped: string[] }> {
    const active = await this.registry.listActive();
    const skipped: string[] = [];
    let restored = 0;
    for (const rec of active) {
      const check = this.validate(rec);
      if (!check.ok) {
        skipped.push(`${rec.name}: ${check.reasons.join("; ")}`);
        continue;
      }
      this.tools.register(this.buildTool(rec));
      restored++;
    }
    return { restored, skipped };
  }

  async listActive(): Promise<CapabilityRecord[]> {
    return this.registry.listActive();
  }
}

/**
 * Gated tools for the propose → approve → activate flow (D-0073).
 *
 *  • `selfext.propose` (LOW_REVERSIBLE): J.A.R.V.I.S.'s own initiative — raises an
 *    announcement + writes an agenda item so the user is ASKED (during a
 *    heartbeat / briefing) whether to activate. It never activates. A heartbeat's
 *    brain pass (ceiling LOW_REVERSIBLE) can run this but not `selfext.activate`.
 *  • `selfext.activate` (CONSEQUENTIAL): the human-approval gate itself — running
 *    it requires approval through any interface; on approval the capability
 *    activates. Nothing self-activates.
 *  • `selfext.deactivate` (LOW_REVERSIBLE): remove an activated capability.
 *  • `selfext.listActive` (READ_ONLY): what's currently active.
 */
export function activationTools(
  activation: ActivationService,
  registry: CapabilityRegistry,
  deps: {
    announce: (input: { text: string; urgency?: "info" | "advisory" | "urgent"; dedupeKey?: string }) => Promise<unknown>;
    addAgenda: (input: { what: string; why?: string }) => Promise<{ id: string }>;
  },
): Tool[] {
  const propose: Tool = {
    name: "selfext.propose",
    description:
      "PROPOSE activating a Stage-A-generated capability — your own initiative. Use this during a heartbeat or briefing when nothing is pressing and you judge a generated capability worth turning on. It raises an announcement and puts the decision on the agenda so the user can approve it through any interface. It does NOT activate anything.",
    riskClass: "LOW_REVERSIBLE",
    action: "propose capability activation",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        rationale: { type: "string", description: "why activating this is useful now" },
      },
      required: ["name", "rationale"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name: string; version?: string; rationale: string };
      const rec = await registry.record(a.name, a.version);
      if (!rec) return { ok: false, summary: `no such capability ${a.name}` };
      const check = activation.validate(rec);
      if (!check.ok) {
        return { ok: false, summary: `capability "${a.name}" is not activatable: ${check.reasons.join("; ")}` };
      }
      const text = `I'd like to activate the capability "${a.name}" (v${rec.version}): ${a.rationale}. It runs only these existing gated tools: ${rec.composition.map((s) => s.tool).join(", ")}. Approve to turn it on.`;
      await deps.announce({ text, urgency: "advisory", dedupeKey: `activate:${a.name}:${rec.version}` });
      const item = await deps.addAgenda({
        what: `Await approval to activate capability "${a.name}" v${rec.version}`,
        why: a.rationale,
      });
      return {
        ok: true,
        summary: `proposed activation of "${a.name}" — announced + on the agenda for your approval`,
        data: { name: a.name, version: rec.version, agendaId: item.id },
      };
    },
  };

  const activate: Tool = {
    name: "selfext.activate",
    description:
      "ACTIVATE a Stage-A-generated capability. This is a consequential action requiring approval — approving it IS the authorization to turn the capability on. On approval the capability's composed gated tools go live (each still individually gated).",
    riskClass: "CONSEQUENTIAL",
    action: "activate a generated capability",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, version: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
    disclose(args: unknown) {
      const a = args as { name: string; version?: string };
      return {
        whatWillHappen: `Activate the generated capability "${a.name}" v${a.version ?? "0.1.0"} — its composed gated tools go live.`,
        affected: [`capability:${a.name}`],
        proposedCommands: [`activate capability:${a.name}`],
        reason:
          "It runs ONLY existing gated tools (a fixed composition); each step stays policy/approval/audit-gated. " +
          "It can never touch policy/approval/audit/e-stop/credentials/sandbox (R-CAP-08, re-validated now).",
        riskClass: "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "Deactivate the capability (selfext.deactivate) to remove its tool.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name: string; version?: string };
      const res = await activation.activate(a.name, a.version);
      return res.ok
        ? { ok: true, summary: `activated "${a.name}" → tool ${res.tool} is live`, data: res }
        : { ok: false, summary: `activation refused: ${(res.reasons ?? []).join("; ")}`, data: res };
    },
  };

  const deactivate: Tool = {
    name: "selfext.deactivate",
    description: "Deactivate an activated capability — removes its live tool. Reversible (it can be re-activated).",
    riskClass: "LOW_REVERSIBLE",
    action: "deactivate a capability",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, version: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name: string; version?: string };
      const ok = await activation.deactivate(a.name, a.version);
      return { ok: true, summary: ok ? `deactivated "${a.name}"` : `"${a.name}" was not active`, data: { name: a.name, ok } };
    },
  };

  const listActive: Tool = {
    name: "selfext.listActive",
    description: "List currently ACTIVE generated capabilities and the tools they compose. Read-only.",
    riskClass: "READ_ONLY",
    action: "list active capabilities",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const active = await activation.listActive();
      return {
        ok: true,
        summary: `${active.length} active capability(ies)`,
        data: active,
        detail:
          active.map((c) => `${c.name} v${c.version} → ${c.composition.map((s) => s.tool).join(", ")}`).join("\n") ||
          "no active capabilities",
      };
    },
  };

  const reviewQueue: Tool = {
    name: "selfext.reviewQueue",
    description:
      "List Stage-A-generated capabilities AWAITING REVIEW — the candidates you may PROPOSE activating (via selfext.propose). Use this to see what's been generated but not yet turned on. Read-only.",
    riskClass: "READ_ONLY",
    action: "list capabilities awaiting review",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const all = await registry.list();
      const pending = all.filter((c) => c.state === "awaiting_review" || c.state === "approved");
      return {
        ok: true,
        summary: `${pending.length} capability(ies) awaiting review`,
        data: pending,
        detail:
          pending.map((c) => `${c.name} v${c.version} [${c.state}] risk=${c.risk_class}`).join("\n") ||
          "nothing awaiting review",
      };
    },
  };

  return [propose, activate, deactivate, listActive, reviewQueue];
}

/**
 * AUTHORING tools (D-0073 completion) — the missing first link of the
 * self-evolution loop: J.A.R.V.I.S. noticing a gap and DRAFTING a new capability
 * ITSELF, over any interface. A draft is **composition-only**: no code files, no
 * permission scopes — strictly narrower than the file-bearing manifests the
 * Stage-A pipeline already accepts from the (Mac-hosted) sandboxed generator.
 * Everything still funnels through the same guard scan and the same
 * propose → approve → activate flow; drafting NEVER activates anything.
 */
export function authoringTools(stageA: StageAPipeline, registry: CapabilityRegistry, tools: ToolRegistry): Tool[] {
  const draft: Tool = {
    name: "selfext.draft",
    description:
      "DRAFT a new capability for yourself by COMPOSING your existing gated tools into a reusable, named sequence " +
      "(e.g. a 'morning-briefing' = perceive.observe then agenda.list). Use this when you notice a recurring need " +
      "your current tools can serve together. The draft is scanned by the hard limit and lands in the review queue — " +
      "it does NOT activate. When the moment is right, propose it (selfext.propose) so the user can approve it.",
    riskClass: "LOW_REVERSIBLE",
    action: "draft a composed capability",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "kebab-case capability name, e.g. morning-briefing" },
        purpose: { type: "string", description: "what need this serves (recorded as provenance)" },
        composition: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tool: { type: "string", description: "an EXISTING gated tool name" },
              args: { type: "object", description: "static args for this step (optional)" },
              note: { type: "string" },
            },
            required: ["tool"],
            additionalProperties: false,
          },
          minItems: 1,
        },
        version: { type: "string" },
      },
      required: ["name", "purpose", "composition"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name: string; purpose: string; composition: CompositionStep[]; version?: string };
      const name = (a.name ?? "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(name)) {
        return { ok: false, summary: `refused: '${a.name}' is not a valid kebab-case capability name` };
      }
      const steps = Array.isArray(a.composition) ? a.composition : [];
      if (!steps.length) return { ok: false, summary: "refused: a draft needs at least one composition step" };
      // Fast, actionable feedback before the guard: every step must be a real,
      // non-denylisted tool, and static args must not smuggle secrets (R-MEM-06).
      for (const step of steps) {
        if (COMPOSITION_TOOL_DENYLIST.some((p) => step.tool?.startsWith(p))) {
          return { ok: false, summary: `refused: composition may not call '${step.tool}' (denylisted — privilege/recursion/self-activation)` };
        }
        if (!step.tool || !tools.has(step.tool)) {
          return { ok: false, summary: `refused: unknown tool '${step.tool}' — compose only tools you actually have (see your tool list)` };
        }
        const argsJson = JSON.stringify(step.args ?? {});
        if (redactSecrets(argsJson) !== argsJson) {
          return { ok: false, summary: "refused: composition args look like they contain a secret — credentials belong in the vault, never in a capability (R-MEM-06)" };
        }
      }
      // Declared risk = the honest ceiling of the composed steps (recomputed
      // again at activation; this just makes the review queue truthful).
      let maxRisk: RiskClass = "READ_ONLY";
      for (const step of steps) {
        const t = tools.get(step.tool);
        if (t && RISK_ORDER[t.riskClass] > RISK_ORDER[maxRisk]) maxRisk = t.riskClass;
      }
      const manifest: CapabilityManifest = {
        name,
        version: a.version?.trim() || "0.1.0",
        riskClass: maxRisk,
        permissions: [], // composition-only drafts request NO permission scopes
        files: [],       // and contain NO code — strictly safe-by-construction
        composition: steps.map((s) => ({ tool: s.tool, ...(s.args ? { args: s.args } : {}), ...(s.note ? { note: s.note } : {}) })),
      };
      const report = await stageA.run(manifest, {
        need: a.purpose,
        context: "drafted by J.A.R.V.I.S. via selfext.draft (composition-only)",
      });
      return report.verdict.decision === "rejected"
        ? { ok: false, summary: `draft REJECTED by the hard limit: ${report.summary}`, data: report }
        : {
            ok: true,
            summary: `drafted "${name}" v${manifest.version} (risk ${maxRisk}) — awaiting review; propose it when the moment is right`,
            data: { name, version: manifest.version, state: "awaiting_review", steps: steps.map((s) => s.tool) },
          };
    },
  };

  const recordGap: Tool = {
    name: "selfext.recordGap",
    description:
      "Record a CAPABILITY GAP — something you were asked to do but genuinely cannot with your current tools " +
      "(and cannot compose from them either — if you CAN compose it, use selfext.draft instead). " +
      "Gaps are visible to the user and feed future capability work. This records only; it builds nothing.",
    riskClass: "LOW_REVERSIBLE",
    action: "record a capability gap",
    inputSchema: {
      type: "object",
      properties: {
        need: { type: "string", description: "what capability was missing" },
        context: { type: "string", description: "where/why the gap surfaced" },
      },
      required: ["need"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { need: string; context?: string };
      const clean = redactSecrets(a.need);
      const id = await registry.recordGap(clean, redactSecrets(a.context ?? ""), true);
      return { ok: true, summary: `capability gap recorded: ${clean.slice(0, 80)}`, data: { id } };
    },
  };

  return [draft, recordGap];
}
