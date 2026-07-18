import { describe, expect, it, vi } from "vitest";
import { assessDepth } from "../src/core/reasoning.js";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { ChatRequest } from "../src/gateway/schema.js";
import type { MemoryService } from "../src/memory/memory.js";

/**
 * Deep-reasoning escalation (D-0048): the assessment is deterministic and
 * explainable; the loop switches ROLE only (provider-agnostic — which LLM
 * serves deep_reasoning is purely gateway config), and degrades honestly when
 * no provider is eligible instead of failing the conversation.
 */

describe("assessDepth", () => {
  it("always honors an explicit ask for deeper thought", () => {
    expect(assessDepth("Think deeply about this one.").mode).toBe("deep");
    expect(assessDepth("walk me through it step by step").mode).toBe("deep");
    expect(assessDepth("take your time on this").mode).toBe("deep");
  });

  it("escalates on two independent signals", () => {
    const long = "analyze the tradeoffs of the two designs. ".repeat(20); // analytical + long
    const d = assessDepth(long);
    expect(d.mode).toBe("deep");
    expect(d.why).toContain("analytical task");
    expect(d.why).toContain("long, detailed brief");
  });

  it("stays fast on a single signal, but reports it", () => {
    const d = assessDepth("analyze this word");
    expect(d.mode).toBe("fast");
    expect(d.why).toContain("analytical task");
  });

  it("stays fast on routine turns", () => {
    const d = assessDepth("Good morning, what's on today?");
    expect(d.mode).toBe("fast");
    expect(d.why).toBe("routine conversational turn");
  });
});

// ---- role selection in the conversation loop ----

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const estop = {
  get isEngaged() { return false; },
  assertClear() {},
  onChange() { return () => {}; },
} as unknown as EmergencyStop;

function convLoop(opts: { deepEligible: boolean }) {
  const calls: ChatRequest[] = [];
  const gw = {
    eligibleTargets: (role: string) =>
      role === "deep_reasoning" && !opts.deepEligible ? [] : [{ provider: "p", model: "m" }],
    chatStream: async function* (req: ChatRequest) {
      calls.push(req);
      yield { type: "text_delta", text: "Very well, sir." };
      yield { type: "done", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } };
      return {
        text: "Very well, sir.", toolCalls: [], finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 }, provider: "p", model: "m", latencyMs: 1,
      };
    },
  } as unknown as GatewayRouter;
  const loop = new CoreLoop({
    gateway: gw, policy: new PolicyEngine(audit, estop), tools: new ToolRegistry(), audit, estop,
    approvals: new ApprovalBroker(audit), activity: new ActivityBus(),
    memory: {} as unknown as MemoryService, toolCtx: { workspaceRoot: "/tmp" },
  });
  return { loop, calls };
}

async function drain(gen: AsyncGenerator<string>) {
  let out = "";
  for await (const t of gen) out += t;
  return out;
}

describe("runConversation — deep-reasoning escalation (D-0048)", () => {
  it("routine turn uses fast_conversation", async () => {
    const { loop, calls } = convLoop({ deepEligible: true });
    await drain(loop.runConversation({ text: "good evening", source: "test" }));
    expect(calls[0]!.role).toBe("fast_conversation");
  });

  it("auto-escalates a deep turn to deep_reasoning and reports the decision first", async () => {
    const { loop, calls } = convLoop({ deepEligible: true });
    const decisions: unknown[] = [];
    await drain(
      loop.runConversation({
        text: "Think deeply: design the arc reactor cooling loop.",
        source: "test",
        onDecision: (d) => decisions.push({ ...d, beforeModelCall: calls.length === 0 }),
      }),
    );
    expect(calls[0]!.role).toBe("deep_reasoning");
    expect(decisions[0]).toEqual({
      mode: "deep",
      why: "you asked for deeper thought",
      role: "deep_reasoning",
      beforeModelCall: true,
    });
  });

  it("explicit override wins in both directions", async () => {
    const { loop, calls } = convLoop({ deepEligible: true });
    await drain(loop.runConversation({ text: "hello there", source: "test", reasoning: "deep" }));
    await drain(
      loop.runConversation({
        text: "Think deeply and analyze everything about this please?",
        source: "test",
        reasoning: "fast",
      }),
    );
    expect(calls[0]!.role).toBe("deep_reasoning");
    expect(calls[1]!.role).toBe("fast_conversation");
  });

  it("downgrades honestly (never errors) when deep_reasoning has no eligible provider", async () => {
    const { loop, calls } = convLoop({ deepEligible: false });
    const decisions: { mode: string; why: string; role: string }[] = [];
    const out = await drain(
      loop.runConversation({
        text: "think deeply about this",
        source: "test",
        onDecision: (d) => decisions.push(d),
      }),
    );
    expect(out).toBe("Very well, sir.");
    expect(calls[0]!.role).toBe("fast_conversation");
    expect(decisions[0]!.mode).toBe("fast");
    expect(decisions[0]!.why).toContain("no eligible deep_reasoning provider");
  });
});
