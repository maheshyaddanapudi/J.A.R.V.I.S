import type { GatewayRouter } from "../gateway/router.js";
import type { NeutralMessage } from "../gateway/schema.js";
import type { ActivityBus } from "./activity.js";
import type { ApprovalBroker, ApprovalResolution } from "./approvals.js";
import type { AuditLog } from "./audit.js";
import type { EmergencyStop } from "./estop.js";
import type { Grant, PolicyEngine, RiskClass } from "./policy.js";
import type { ToolContext, ToolRegistry } from "./tools.js";
import {
  assessDepth,
  type DepthAssessment,
  type ReasoningMode,
  type ReasoningTuner,
} from "./reasoning.js";
import type { MemoryService } from "../memory/memory.js";
import type { EpisodicMemory } from "../memory/episodes.js";
import type { ContextService } from "../context/service.js";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * The core loop (R-CORE-03), Phase-1 scope:
 *   objective → (optional tool decision) → gated execution → verify → record.
 *
 * A request may either be answered by the conversation model (streamed tokens)
 * or routed to a named tool. Tool execution passes through the policy engine;
 * consequential tools require approval with full pre-action disclosure; results
 * are independently verified and everything is audited + emitted to the timeline.
 */
export class CoreLoop {
  /** last moment a USER-driven request touched the loop (heartbeat excluded) —
   *  lets the scheduler defer its brain pass while a live session is active */
  lastUserActivityAt: string | null = null;
  private touch(source: string): void {
    if (source !== "heartbeat") this.lastUserActivityAt = new Date().toISOString();
  }
  private sessionGrants: Grant[] = [];

  constructor(
    private readonly deps: {
      gateway: GatewayRouter;
      policy: PolicyEngine;
      tools: ToolRegistry;
      audit: AuditLog;
      estop: EmergencyStop;
      approvals: ApprovalBroker;
      activity: ActivityBus;
      memory: MemoryService;
      toolCtx: ToolContext;
      /** situational awareness injected into conversational context (read-only) */
      context?: ContextService;
      /** episodic memory — real consequential actions are recorded on the timeline */
      episodes?: EpisodicMemory;
      /** deep-reasoning learning (D-0050): learned topics + corrections */
      reasoningTuner?: ReasoningTuner;
      /** decision journal (D-0051): categorical record for the sleep cycle */
      decisions?: import("./consolidation.js").DecisionLog;
      /** durable consent store (D-0059): "always-allow-in-scope" persists */
      durableGrants?: import("./grants.js").DurableGrants;
    },
  ) {}

  /** Hydrate standing consent at startup so durable grants survive restart. */
  async loadDurableGrants(): Promise<number> {
    if (!this.deps.durableGrants) return 0;
    const grants = await this.deps.durableGrants.load();
    // keep any in-memory session grants; prepend the durable ones
    this.sessionGrants = [...grants, ...this.sessionGrants];
    return grants.length;
  }

  /**
   * Run a tool request end to end. Returns the outcome; streams activity events
   * throughout. (Conversation-only requests go through runConversation.)
   */
  async runTool(input: {
    tool: string;
    args: unknown;
    source: string;
    resourceScope?: string;
    delegatedAutomation?: boolean;
    /**
     * Scripted/test flows may pre-declare a resolution. When undefined, a
     * needs-approval decision waits for a real resolution through the approval
     * broker (an interface calls /core/approvals/resolve).
     */
    autoApprove?: ApprovalResolution;
  }): Promise<{ ok: boolean; summary: string; denied?: boolean; detail?: string; untrusted?: boolean }> {
    const now = () => new Date().toISOString();
    if (this.deps.estop.isEngaged) {
      return { ok: false, summary: "emergency stop engaged — execution halted", denied: true };
    }

    this.touch(input.source);
    const tool = this.deps.tools.get(input.tool);
    if (!tool) {
      this.deps.activity.emit({ kind: "error", message: `unknown tool ${input.tool}`, at: now() });
      return { ok: false, summary: `unknown tool: ${input.tool}` };
    }

    // Pre-action disclosure for consequential tools (R-CTRL-04). A tool that
    // rejects its own args here (e.g. an out-of-scope path) is a clean denial,
    // not a server error.
    if (tool.disclose) {
      try {
        const disclosure = tool.disclose(input.args, this.deps.toolCtx);
        this.deps.activity.emit({
          kind: "tool_proposed",
          tool: tool.name,
          risk: tool.riskClass,
          disclosure,
          at: now(),
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        await this.deps.audit.append({
          actor: "kernel",
          event: "tool_refused",
          payload: { tool: tool.name, source: input.source, reason },
        });
        this.deps.activity.emit({ kind: "tool_result", tool: tool.name, ok: false, summary: reason, at: now() });
        return { ok: false, summary: reason, denied: true };
      }
    }

    const decision = await this.deps.policy.evaluate({
      tool: tool.name,
      action: tool.action,
      riskClass: tool.riskClass as RiskClass,
      ...(input.resourceScope !== undefined ? { resourceScope: input.resourceScope } : {}),
      grants: this.sessionGrants,
      ...(input.delegatedAutomation !== undefined
        ? { delegatedAutomation: input.delegatedAutomation }
        : {}),
      reason: `run ${tool.name}`,
      source: input.source,
    });

    if (decision.effect === "deny") {
      this.deps.activity.emit({
        kind: "tool_result",
        tool: tool.name,
        ok: false,
        summary: `denied: ${decision.reason}`,
        at: now(),
      });
      return { ok: false, summary: `denied: ${decision.reason}`, denied: true };
    }

    if (decision.effect === "needs_approval") {
      const { id, wait } = this.deps.approvals.create(tool.name, input.resourceScope ?? null);
      this.deps.activity.emit({ kind: "approval_required", tool: tool.name, requestId: id, at: now() });
      // Scripted flows resolve immediately; real interfaces call the broker.
      if (input.autoApprove) {
        void this.deps.approvals.resolve(id, input.autoApprove, input.source);
      }
      const resolution = await wait;
      if (resolution === "deny") {
        this.deps.activity.emit({
          kind: "tool_result",
          tool: tool.name,
          ok: false,
          summary: "denied by user",
          at: now(),
        });
        return { ok: false, summary: "denied by user", denied: true };
      }
      this.rememberGrant(resolution, tool, input.resourceScope ?? "*");
    }

    // Re-check e-stop immediately before executing (it may have engaged during approval).
    this.deps.estop.assertClear();

    let result: Awaited<ReturnType<typeof tool.run>>;
    try {
      result = await tool.run(input.args, this.deps.toolCtx);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.deps.audit.append({
        actor: "kernel",
        event: "tool_error",
        payload: { tool: tool.name, source: input.source, reason },
      });
      this.deps.activity.emit({ kind: "tool_result", tool: tool.name, ok: false, summary: reason, at: now() });
      return { ok: false, summary: reason };
    }
    await this.deps.audit.append({
      actor: "kernel",
      event: "tool_call",
      payload: {
        tool: tool.name,
        source: input.source,
        ok: result.ok,
        summary: result.summary,
        reversible: Boolean(result.rollback),
      },
    });
    this.deps.activity.emit({
      kind: "tool_result",
      tool: tool.name,
      ok: result.ok,
      summary: result.summary,
      at: now(),
    });

    // Independent verification (R-CORE-03): confirm the claimed effect really happened.
    const verified = await this.verify(tool.name, result);
    this.deps.activity.emit({ kind: "verified", ok: verified.ok, summary: verified.summary, at: now() });
    await this.deps.audit.append({
      actor: "kernel",
      event: "verification",
      payload: { tool: tool.name, ok: verified.ok, summary: verified.summary },
    });

    // Episodic memory (D-0041): a genuinely consequential action that succeeded
    // is an EVENT worth remembering — record it on the timeline so J.A.R.V.I.S.
    // can recall "the last time you…". Read-only lookups and memory bookkeeping
    // are not events. Best-effort: a memory failure must never break the loop.
    if (
      this.deps.episodes &&
      result.ok &&
      verified.ok &&
      (tool.riskClass === "CONSEQUENTIAL" || tool.riskClass === "HIGH_RISK_PHYSICAL") &&
      !tool.name.startsWith("memory.")
    ) {
      try {
        await this.deps.episodes.record({
          summary: `${tool.name}: ${result.summary}`,
          kind: "action",
          importance: tool.riskClass === "HIGH_RISK_PHYSICAL" ? 0.8 : 0.6,
          tags: [tool.name.split(".")[0] ?? "action"],
          provenance: `tool:${input.source}`,
        });
      } catch {
        /* episodic recording is best-effort */
      }
    }

    // `detail` (a tool's model-facing output) is returned to callers — the agent
    // feeds it to the model, the HTTP caller gets the structured read. It is NOT
    // audited (content stays local; audit records the summary only).
    return {
      ok: result.ok && verified.ok,
      summary: result.summary,
      ...(result.detail !== undefined ? { detail: result.detail } : {}),
      ...(result.untrusted ? { untrusted: true } : {}),
    };
  }

  /**
   * Stream a conversational answer via the gateway; persist both turns to
   * conversation memory and carry prior context (R-MEM-01); audit + emit
   * activity. When `sessionId` is given, prior turns for that session are
   * prepended so J.A.R.V.I.S. actually remembers the conversation.
   */
  async *runConversation(input: {
    text: string;
    source: string;
    sessionId?: string;
    privacyClass?: "LOCAL_ONLY" | "STANDARD";
    /** optional preface (persona/system); persisted separately, not to memory */
    system?: string;
    /** deep-reasoning escalation (D-0048): "auto" assesses the turn; explicit
     *  "deep"/"fast" always wins. Only the model ROLE changes — never gates. */
    reasoning?: "auto" | "deep" | "fast";
    /** called once with the routing decision before any token streams */
    onDecision?: (d: { mode: ReasoningMode; why: string; role: string }) => void;
  }): AsyncGenerator<string> {
    this.deps.estop.assertClear();
    this.touch(input.source);
    const now = () => new Date().toISOString();

    // Decide which brain answers (D-0048). Provider-agnostic: the roles map to
    // whatever the gateway config routes them to (local or remote).
    const requested = input.reasoning ?? "auto";
    // Learned deep topics + bounded autotune (D-0050/51) sharpen the auto
    // assessment; both best-effort.
    let learnedTopics: string[] = [];
    let threshold = 2;
    if (this.deps.reasoningTuner) {
      try {
        learnedTopics = await this.deps.reasoningTuner.topics();
        threshold = (await this.deps.reasoningTuner.autotune()).signalThreshold;
      } catch { /* learning must never block a conversation */ }
    }
    let decision: DepthAssessment =
      requested === "auto"
        ? assessDepth(input.text, learnedTopics, threshold)
        : { mode: requested, why: "explicitly requested", reason: "override" };
    // Learning-by-correction (D-0050): the user explicitly forced deep on a
    // turn the auto assessment would have kept fast — remember what it was
    // about; repeated corrections promote the topic to always-deep.
    if (requested === "deep" && this.deps.reasoningTuner) {
      try {
        if (assessDepth(input.text, learnedTopics, threshold).mode === "fast") {
          const promoted = await this.deps.reasoningTuner.recordCorrection(input.text);
          if (promoted.length) {
            decision = {
              mode: "deep",
              why: `explicitly requested — noted, I'll think deeply about '${promoted.join("', '")}' from now on`,
              reason: "correction_promoted",
            };
          }
        }
      } catch { /* learning must never block a conversation */ }
    }
    const privacy = input.privacyClass ?? "LOCAL_ONLY";
    let role: "fast_conversation" | "deep_reasoning" =
      decision.mode === "deep" ? "deep_reasoning" : "fast_conversation";
    if (role === "deep_reasoning") {
      // Honest downgrade, never a hard failure: if no provider is eligible for
      // deep_reasoning under the current privacy/offline constraints, say so
      // and answer with the fast role rather than erroring the conversation.
      try {
        if (this.deps.gateway.eligibleTargets("deep_reasoning", privacy).length === 0) {
          decision = { mode: "fast", why: `${decision.why} — but no eligible deep_reasoning provider (privacy/offline), answering fast`, reason: "downgrade_ineligible" };
          role = "fast_conversation";
        }
      } catch {
        decision = { mode: "fast", why: `${decision.why} — but deep_reasoning is unconfigured, answering fast`, reason: "downgrade_ineligible" };
        role = "fast_conversation";
      }
    }
    input.onDecision?.({ mode: decision.mode, why: decision.why, role });
    // Journal the decision (D-0051, categorical only) so the sleep cycle can
    // learn from J.A.R.V.I.S.'s own routing record; never blocks the turn.
    await this.deps.decisions?.record({
      requested,
      mode: decision.mode,
      reason: decision.reason,
      role,
    });
    if (decision.mode === "deep" || requested !== "auto") {
      this.deps.activity.emit({
        kind: "decision",
        summary: `reasoning: ${decision.mode} (${decision.why})`,
        at: now(),
      });
    }

    const messages: NeutralMessage[] = [];
    if (input.system) messages.push({ role: "system", content: input.system });
    // Situational awareness (R-CTX): reference data, clearly labeled as
    // background, never as an instruction to act. Assembly failure must never
    // block a conversation.
    if (this.deps.context) {
      try {
        messages.push({ role: "system", content: await this.deps.context.describe() });
      } catch {
        /* context is best-effort */
      }
    }
    if (input.sessionId) {
      const history = await this.deps.memory.conversation(input.sessionId, 20);
      for (const turn of history) {
        if (turn.role === "user")
          messages.push({ role: "user", content: [{ type: "text", text: turn.content }] });
        else messages.push({ role: "assistant", content: turn.content });
      }
    }
    messages.push({ role: "user", content: [{ type: "text", text: input.text }] });

    if (input.sessionId) await this.deps.memory.addTurn(input.sessionId, "user", input.text);

    const gen = this.deps.gateway.chatStream({
      role,
      messages,
      privacyClass: privacy,
      source: input.source,
    });
    let answer = "";
    while (true) {
      // barge-in / e-stop can interrupt mid-stream
      if (this.deps.estop.isEngaged) {
        this.deps.activity.emit({ kind: "error", message: "halted by emergency stop", at: now() });
        if (input.sessionId && answer)
          await this.deps.memory.addTurn(input.sessionId, "assistant", answer + " [interrupted]");
        return;
      }
      const step = await gen.next();
      if (step.done) {
        this.deps.activity.emit({
          kind: "model",
          role,
          provider: step.value.provider,
          model: step.value.model,
          at: now(),
        });
        if (input.sessionId && answer)
          await this.deps.memory.addTurn(input.sessionId, "assistant", answer);
        return;
      }
      if (step.value.type === "text_delta") {
        answer += step.value.text;
        this.deps.activity.emit({ kind: "token", text: step.value.text, at: now() });
        yield step.value.text;
      }
    }
  }

  private rememberGrant(resolution: ApprovalResolution, tool: { name: string }, scope: string): void {
    if (resolution === "allow-for-session" || resolution === "always-allow-in-scope") {
      this.sessionGrants.push({
        tool: tool.name,
        scope,
        riskCeiling: "CONSEQUENTIAL",
        kind: resolution,
      });
      // "always-allow-in-scope" is DURABLE consent — persist it so it survives a
      // restart (D-0059). "allow-for-session" stays in-memory (a session ends).
      if (resolution === "always-allow-in-scope" && this.deps.durableGrants) {
        void this.deps.durableGrants
          .remember(tool.name, scope, "CONSEQUENTIAL")
          .catch(() => {/* persistence is best-effort; the in-memory grant still holds this session */});
      }
    }
  }

  private async verify(toolName: string, result: { ok: boolean; data?: unknown }): Promise<{
    ok: boolean;
    summary: string;
  }> {
    // Tool-specific independent checks (never "the tool said ok, so ok").
    if (toolName === "workspace.writeNote" && result.data && typeof result.data === "object") {
      const { path } = result.data as { path?: string };
      if (path) {
        try {
          const { stat } = await import("node:fs/promises");
          await stat(path);
          return { ok: true, summary: `verified file exists at ${path}` };
        } catch {
          return { ok: false, summary: `verification FAILED: ${path} not found after write` };
        }
      }
    }
    // files.edit reports its resulting content; re-read the file off disk and
    // confirm it matches what the edit claims to have written (R-CORE-03) — an
    // edit is only "verified" if the bytes on disk actually changed as stated.
    if (toolName === "files.edit" && result.data && typeof result.data === "object") {
      const { path, contentAfter } = result.data as { path?: string; contentAfter?: string };
      if (typeof path === "string" && typeof contentAfter === "string") {
        try {
          const { readFile } = await import("node:fs/promises");
          const { resolve } = await import("node:path");
          const onDisk = await readFile(resolve(this.deps.toolCtx.workspaceRoot, path), "utf8");
          return onDisk === contentAfter
            ? { ok: true, summary: `verified: on-disk content of ${path} matches the applied edit` }
            : { ok: false, summary: `verification FAILED: ${path} on disk differs from the applied edit` };
        } catch {
          return { ok: false, summary: `verification FAILED: ${path} unreadable after edit` };
        }
      }
    }
    return { ok: result.ok, summary: "no independent check registered; used tool-reported status" };
  }
}
