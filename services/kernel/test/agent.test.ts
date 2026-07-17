import { describe, expect, it, vi } from "vitest";
import { LocalAgentRuntime } from "../src/agent/runtime.js";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry, type Tool } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { ChatRequest, ChatResult, ToolCall } from "../src/gateway/schema.js";
import type { MemoryService } from "../src/memory/memory.js";

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

// A mutable fake e-stop we can flip mid-plan.
function makeEstop(engaged = { v: false }) {
  return {
    get isEngaged() {
      return engaged.v;
    },
    assertClear() {
      if (engaged.v) throw new Error("emergency stop engaged");
    },
    onChange() {
      return () => {};
    },
  } as unknown as EmergencyStop;
}

// Real tools: a READ_ONLY lookup and a CONSEQUENTIAL write.
function makeTools(readRan: { n: number }, writeRan: { n: number }): ToolRegistry {
  const reg = new ToolRegistry();
  const read: Tool = {
    name: "test.lookup", description: "look something up", riskClass: "READ_ONLY",
    action: "look up", inputSchema: { type: "object" },
    async run() { readRan.n++; return { ok: true, summary: "looked up 1 record", detail: "RECORD: the answer is 42" }; },
  };
  const write: Tool = {
    name: "test.write", description: "write something", riskClass: "CONSEQUENTIAL",
    action: "write", inputSchema: { type: "object" },
    disclose() {
      return { whatWillHappen: "write", affected: [], proposedCommands: [], reason: "test",
        riskClass: "CONSEQUENTIAL", reversible: true, rollbackPlan: "undo" };
    },
    async run() { writeRan.n++; return { ok: true, summary: "wrote it" }; },
  };
  reg.register(read);
  reg.register(write);
  return reg;
}

// A gateway whose chat() returns a scripted sequence of ChatResults.
function scriptedGateway(script: Partial<ChatResult>[]): { gw: GatewayRouter; calls: ChatRequest[] } {
  let i = 0;
  const calls: ChatRequest[] = [];
  const gw = {
    chat: async (req: ChatRequest): Promise<ChatResult> => {
      calls.push(req);
      const s = script[Math.min(i, script.length - 1)]!;
      i++;
      return {
        text: s.text ?? "", toolCalls: s.toolCalls ?? [], finishReason: s.toolCalls?.length ? "tool_use" : "stop",
        usage: { inputTokens: 0, outputTokens: 0 }, provider: "fake", model: "fake", latencyMs: 1,
      };
    },
  } as unknown as GatewayRouter;
  return { gw, calls };
}

const tc = (name: string, args: unknown = {}): ToolCall => ({ id: `c${Math.random()}`, name, arguments: args });

function makeLoop(gw: GatewayRouter, tools: ToolRegistry, estop: EmergencyStop) {
  const policy = new PolicyEngine(audit, estop);
  const approvals = new ApprovalBroker(audit);
  const activity = new ActivityBus();
  const loop = new CoreLoop({
    gateway: gw, policy, tools, audit, estop, approvals, activity,
    memory: {} as unknown as MemoryService, toolCtx: { workspaceRoot: "/tmp" },
  });
  return { loop, activity, estop };
}

describe("LocalAgentRuntime (multi-step plan-and-act through the gated loop)", () => {
  it("runs a multi-step plan: tool call → tool result → final answer", async () => {
    const readRan = { n: 0 }, writeRan = { n: 0 };
    const tools = makeTools(readRan, writeRan);
    const estop = makeEstop();
    const { gw } = scriptedGateway([
      { toolCalls: [tc("test.lookup")] },     // step 1: use a read-only tool
      { text: "The answer is 42." },          // step 2: final answer
    ]);
    const { loop, activity } = makeLoop(gw, tools, estop);
    const agent = new LocalAgentRuntime({ gateway: gw, loop, tools, audit, activity, estop });

    const res = await agent.run("look it up and tell me");
    expect(res.steps.map((s) => s.tool)).toEqual(["test.lookup"]);
    expect(res.steps[0]!.ok).toBe(true);
    expect(readRan.n).toBe(1);
    expect(res.answer).toBe("The answer is 42.");
    expect(res.halted).toBe(false);
    expect(res.budgetExhausted).toBe(false);
  });

  it("feeds a read tool's detail back to the model (not just the summary)", async () => {
    const readRan = { n: 0 }, writeRan = { n: 0 };
    const tools = makeTools(readRan, writeRan);
    const estop = makeEstop();
    const { gw, calls } = scriptedGateway([
      { toolCalls: [tc("test.lookup")] }, // step 1: read tool returns detail
      { text: "42." },                    // step 2: answer
    ]);
    const { loop, activity } = makeLoop(gw, tools, estop);
    const agent = new LocalAgentRuntime({ gateway: gw, loop, tools, audit, activity, estop });

    await agent.run("look it up");
    // the SECOND model call must include the tool message carrying the detail
    const toolMsg = calls[1]!.messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    const content = String((toolMsg as { content: unknown }).content);
    expect(content).toContain("the answer is 42"); // the detail reached the model
    expect(content).toContain("summary");
  });

  it("a CONSEQUENTIAL step still goes through approval — denied when the user denies", async () => {
    const readRan = { n: 0 }, writeRan = { n: 0 };
    const tools = makeTools(readRan, writeRan);
    const estop = makeEstop();
    const { gw } = scriptedGateway([
      { toolCalls: [tc("test.write")] },      // consequential — needs approval
      { text: "I could not complete the write." },
    ]);
    const { loop, activity } = makeLoop(gw, tools, estop);
    const agent = new LocalAgentRuntime({ gateway: gw, loop, tools, audit, activity, estop });

    const res = await agent.run("write the file", { autoApprove: "deny" });
    expect(res.steps[0]!.denied).toBe(true);
    expect(res.steps[0]!.ok).toBe(false);
    expect(writeRan.n).toBe(0); // the tool NEVER ran — the gate stopped it
  });

  it("a CONSEQUENTIAL step runs when approved", async () => {
    const readRan = { n: 0 }, writeRan = { n: 0 };
    const tools = makeTools(readRan, writeRan);
    const estop = makeEstop();
    const { gw } = scriptedGateway([
      { toolCalls: [tc("test.write")] },
      { text: "Done." },
    ]);
    const { loop, activity } = makeLoop(gw, tools, estop);
    const agent = new LocalAgentRuntime({ gateway: gw, loop, tools, audit, activity, estop });

    const res = await agent.run("write the file", { autoApprove: "allow-once" });
    expect(res.steps[0]!.ok).toBe(true);
    expect(writeRan.n).toBe(1);
    expect(res.answer).toBe("Done.");
  });

  it("stops when the emergency stop is engaged mid-plan", async () => {
    const readRan = { n: 0 }, writeRan = { n: 0 };
    const tools = makeTools(readRan, writeRan);
    const flag = { v: false };
    const estop = makeEstop(flag);
    // model keeps asking for tools; we engage estop after the first gateway call
    const { gw } = scriptedGateway([{ toolCalls: [tc("test.lookup")] }]);
    const origChat = (gw as unknown as { chat: (r: unknown) => Promise<unknown> }).chat;
    (gw as unknown as { chat: (r: unknown) => Promise<unknown> }).chat = async (r: unknown) => {
      const out = await origChat(r);
      flag.v = true; // engage e-stop right after the model proposes the tool
      return out;
    };
    const { loop, activity } = makeLoop(gw, tools, estop);
    const agent = new LocalAgentRuntime({ gateway: gw, loop, tools, audit, activity, estop });

    const res = await agent.run("keep going forever");
    expect(res.halted).toBe(true);
    expect(res.answer).toMatch(/halted/);
  });

  it("bounds runaway loops with the step budget", async () => {
    const readRan = { n: 0 }, writeRan = { n: 0 };
    const tools = makeTools(readRan, writeRan);
    const estop = makeEstop();
    // model ALWAYS asks for another tool → never finalizes
    const { gw } = scriptedGateway([{ toolCalls: [tc("test.lookup")] }]);
    const { loop, activity } = makeLoop(gw, tools, estop);
    const agent = new LocalAgentRuntime({ gateway: gw, loop, tools, audit, activity, estop });

    const res = await agent.run("never stop", { maxSteps: 3 });
    expect(res.budgetExhausted).toBe(true);
    expect(res.stepsUsed).toBe(3);
    expect(res.answer).toMatch(/budget/);
  });
});
