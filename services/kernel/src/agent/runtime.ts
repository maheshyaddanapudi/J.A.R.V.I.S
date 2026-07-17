import type { GatewayRouter } from "../gateway/router.js";
import type { NeutralMessage, ToolDefinition } from "../gateway/schema.js";
import type { CoreLoop } from "../core/loop.js";
import type { ToolRegistry } from "../core/tools.js";
import type { AuditLog } from "../core/audit.js";
import type { ActivityBus } from "../core/activity.js";
import type { EmergencyStop } from "../core/estop.js";
import type { AgentResult, AgentRunOptions, AgentRuntime, AgentStep } from "./contract.js";

const DEFAULT_MAX_STEPS = 6;
/** Per-step cap on tool `detail` fed to the model (chars) — bounds context growth. */
const DETAIL_BUDGET = 6000;

const AGENT_SYSTEM =
  "You are J.A.R.V.I.S. carrying out a task for the user. Break the objective into " +
  "steps. Use the provided tools when an action or lookup is needed; call one tool " +
  "at a time and use the result before the next. When the objective is met, reply " +
  "with a concise final answer and no further tool calls. Never claim a tool ran " +
  "unless its result says so.";

/**
 * Built-in local agent runtime. Iterative tool-use loop over the model gateway's
 * native tool calling; every tool call is executed through the gated core loop.
 */
export class LocalAgentRuntime implements AgentRuntime {
  constructor(
    private readonly deps: {
      gateway: GatewayRouter;
      loop: CoreLoop;
      tools: ToolRegistry;
      audit: AuditLog;
      activity: ActivityBus;
      estop: EmergencyStop;
    },
  ) {}

  async run(objective: string, opts: AgentRunOptions = {}): Promise<AgentResult> {
    const maxSteps = Math.max(1, Math.min(opts.maxSteps ?? DEFAULT_MAX_STEPS, 20));
    const privacyClass = opts.privacyClass ?? "LOCAL_ONLY";
    const source = opts.source ?? "agent";
    const now = () => new Date().toISOString();

    const toolDefs: ToolDefinition[] = this.deps.tools.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    const messages: NeutralMessage[] = [
      { role: "system", content: AGENT_SYSTEM },
      { role: "user", content: [{ type: "text", text: objective }] },
    ];

    this.deps.activity.emit({ kind: "objective", text: objective, at: now() });
    await this.deps.audit.append({
      actor: "user",
      event: "agent_run_started",
      payload: { objective: objective.slice(0, 200), maxSteps },
    });

    const steps: AgentStep[] = [];
    let answer = "";
    let budgetExhausted = false;
    let halted = false;

    for (let i = 0; i < maxSteps; i++) {
      if (this.deps.estop.isEngaged) {
        halted = true;
        break;
      }

      const result = await this.deps.gateway.chat({
        role: "planning",
        messages,
        tools: toolDefs,
        privacyClass,
        source,
      });

      // No tool calls → the model has answered.
      if (!result.toolCalls.length) {
        answer = result.text;
        messages.push({ role: "assistant", content: result.text });
        break;
      }

      // Record the assistant's tool-call turn, then execute each call through the
      // gated loop and feed the result back.
      messages.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });

      for (const call of result.toolCalls) {
        if (this.deps.estop.isEngaged) {
          halted = true;
          break;
        }
        const exec = await this.deps.loop.runTool({
          tool: call.name,
          args: call.arguments,
          source,
          ...(opts.autoApprove ? { autoApprove: opts.autoApprove } : {}),
        });
        const step: AgentStep = {
          index: steps.length,
          tool: call.name,
          args: call.arguments,
          ok: exec.ok,
          ...(exec.denied ? { denied: true } : {}),
          summary: exec.summary,
        };
        steps.push(step);
        this.deps.activity.emit({
          kind: "tool_result",
          tool: call.name,
          ok: exec.ok,
          summary: exec.summary,
          at: now(),
        });
        // Feed the tool's model-facing output back so the agent can actually
        // reason over it (a read tool's summary alone is not enough). Bounded to
        // keep one step from flooding the context.
        const detail = exec.detail ? exec.detail.slice(0, DETAIL_BUDGET) : undefined;
        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: JSON.stringify({
            ok: exec.ok,
            denied: exec.denied ?? false,
            summary: exec.summary,
            ...(detail ? { detail, detailTruncated: (exec.detail?.length ?? 0) > DETAIL_BUDGET } : {}),
          }),
        });
      }

      if (halted) break;
      if (i === maxSteps - 1) budgetExhausted = true;
    }

    if (halted) {
      this.deps.activity.emit({ kind: "error", message: "agent halted by emergency stop", at: now() });
    }
    await this.deps.audit.append({
      actor: "kernel",
      event: "agent_run_finished",
      payload: { steps: steps.length, budgetExhausted, halted, answered: Boolean(answer) },
    });

    return {
      objective,
      answer: answer || (halted ? "[halted by emergency stop]" : budgetExhausted ? "[step budget exhausted before an answer]" : ""),
      steps,
      stepsUsed: steps.length,
      budgetExhausted,
      halted,
    };
  }
}
