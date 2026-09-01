import { describe, expect, it, vi } from "vitest";
import { assessDepth, ReasoningTuner, type TunerStore } from "../src/core/reasoning.js";
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

  it("a learned topic escalates alone, with the taught why", () => {
    const d = assessDepth("what's the status of the palladium core?", ["palladium"]);
    expect(d.mode).toBe("deep");
    expect(d.why).toContain("taught me to think deeply about 'palladium'");
    expect(assessDepth("what's for dinner?", ["palladium"]).mode).toBe("fast");
  });
});

// ---- learning (D-0050): instruction + correction, stored as preferences ----

function fakeStore(): TunerStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      const v = data.get(key);
      return v === undefined ? null : { value: v };
    },
    async remember(input) {
      data.set(input.key, input.value);
      return {};
    },
  };
}

describe("ReasoningTuner", () => {
  it("teach/forget round-trips through the preference store", async () => {
    const tuner = new ReasoningTuner(fakeStore());
    expect(await tuner.topics()).toEqual([]);
    await tuner.teach("Vibranium");
    expect(await tuner.topics()).toEqual(["vibranium"]);
    await tuner.teach("vibranium"); // idempotent
    expect(await tuner.topics()).toEqual(["vibranium"]);
    await tuner.forget("vibranium");
    expect(await tuner.topics()).toEqual([]);
  });

  it("promotes a judge-confirmed topic after two corrections about it — not one", async () => {
    const judge = { extractTopics: async () => ["vibranium"] };
    const tuner = new ReasoningTuner(fakeStore(), judge);
    const first = await tuner.recordCorrection("check the vibranium shield tolerances");
    expect(first).toEqual({ promoted: [], noted: ["vibranium"], deferred: false });
    expect(await tuner.topics()).toEqual([]);
    const second = await tuner.recordCorrection("vibranium alloy stress numbers again");
    expect(second.promoted).toEqual(["vibranium"]);
    expect(await tuner.topics()).toContain("vibranium");
  });

  it("uses the judge's extracted topic instead of noisy heuristic terms (D-0075)", async () => {
    // raw text is full of filler ('quick','one-line','intuition'); the judge
    // returns only the real subject.
    const judge = { extractTopics: async () => ["palladium"] };
    const tuner = new ReasoningTuner(fakeStore(), judge);
    await tuner.recordCorrection("Quick one-line intuition about palladium please");
    const { promoted } = await tuner.recordCorrection("Quick one-line intuition about palladium please");
    expect(promoted).toEqual(["palladium"]);
    expect(await tuner.topics()).toEqual(["palladium"]); // ONLY the topic, no filler
  });

  // ---- D-0080 C2 (R-MEM-10): the fallback may accumulate, never promote ----

  it("without a judge (null) the heuristic fallback accumulates but NEVER promotes, and says so", async () => {
    const store = fakeStore();
    const offline = new ReasoningTuner(store, { extractTopics: async () => null });
    const a = await offline.recordCorrection("check the vibranium shield tolerances");
    expect(a.promoted).toEqual([]);
    expect(a.deferred).toBe(true);
    expect(a.noted).toContain("vibranium");
    const b = await offline.recordCorrection("vibranium alloy stress numbers again");
    expect(b).toMatchObject({ promoted: [], deferred: true });
    expect(await offline.topics()).toEqual([]); // pre-D-0080 this promoted 'vibranium' here
    const ledger = JSON.parse(store.data.get("reasoning_deep_candidates")!) as Record<string, { count: number; judged: number }>;
    expect(ledger["vibranium"]).toEqual({ count: 2, judged: 0 });

    // …one judge-confirmed mention later, the accumulated count promotes it.
    const online = new ReasoningTuner(store, { extractTopics: async () => ["vibranium"] });
    const c = await online.recordCorrection("vibranium again, think about it");
    expect(c).toEqual({ promoted: ["vibranium"], noted: [], deferred: false });
    expect(await online.topics()).toEqual(["vibranium"]);
  });

  it("no judge configured at all behaves like judge=null (accumulate only)", async () => {
    const tuner = new ReasoningTuner(fakeStore());
    for (let i = 0; i < 3; i++) {
      expect((await tuner.recordCorrection("vibranium shield tolerances")).deferred).toBe(true);
    }
    expect(await tuner.topics()).toEqual([]);
  });

  it("replay: the six Longitude-XL outage terms never promote without a judge", async () => {
    const tuner = new ReasoningTuner(fakeStore(), { extractTopics: async () => null });
    const outage = [
      "remind me about lunch, second reminder please",
      "does the coffee place do lunch? remind me",
      "umbrella? the sky looks grey, second opinion",
      "coffee first, then lunch — looks like rain, umbrella",
    ];
    for (let round = 0; round < 3; round++) {
      for (const text of outage) expect((await tuner.recordCorrection(text)).promoted).toEqual([]);
    }
    expect(await tuner.topics()).toEqual([]);
  });

  it("reads a legacy numeric candidate map (pre-D-0080) as unjudged counts", async () => {
    const store = fakeStore();
    store.data.set("reasoning_deep_candidates", JSON.stringify({ vibranium: 1, umbrella: 5 }));
    // an unjudged mention cannot promote even a high legacy count…
    const offline = new ReasoningTuner(store, { extractTopics: async () => null });
    expect((await offline.recordCorrection("umbrella again")).promoted).toEqual([]);
    // …but one judge-confirmed mention promotes a legacy count that already reached the bar
    const online = new ReasoningTuner(store, { extractTopics: async () => ["vibranium"] });
    expect((await online.recordCorrection("vibranium please")).promoted).toEqual(["vibranium"]);
    const ledger = JSON.parse(store.data.get("reasoning_deep_candidates")!) as Record<string, { count: number; judged: number }>;
    expect(ledger["umbrella"]).toEqual({ count: 6, judged: 0 });
    expect(ledger["vibranium"]).toBeUndefined();
  });

  it("bounds the candidate ledger during an outage (unjudged low-count entries dropped first)", async () => {
    const store = fakeStore();
    const tuner = new ReasoningTuner(store, { extractTopics: async () => null });
    for (let i = 0; i < 40; i++) {
      // 8 distinct ≥5-letter terms per correction → 320 candidates offered
      await tuner.recordCorrection(Array.from({ length: 8 }, (_, j) => `term${String(i * 8 + j).padStart(4, "0")}x`).join(" "));
    }
    const ledger = JSON.parse(store.data.get("reasoning_deep_candidates")!) as Record<string, unknown>;
    expect(Object.keys(ledger).length).toBeLessThanOrEqual(200);
    expect(await tuner.topics()).toEqual([]);
  });

  it("a failing store never throws out of topics()", async () => {
    const tuner = new ReasoningTuner({
      get: async () => { throw new Error("db down"); },
      remember: async () => { throw new Error("db down"); },
    });
    expect(await tuner.topics()).toEqual([]);
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

  it("auto-escalates on a learned topic and records corrections that promote new ones", async () => {
    const store = fakeStore();
    const tuner = new ReasoningTuner(store, { extractTopics: async () => ["vibranium"] });
    await tuner.teach("palladium");
    const { loop, calls } = convLoop({ deepEligible: true });
    (loop as unknown as { deps: { reasoningTuner?: ReasoningTuner } }).deps.reasoningTuner = tuner;

    // learned topic → auto goes deep
    await drain(loop.runConversation({ text: "any palladium updates?", source: "test" }));
    expect(calls[0]!.role).toBe("deep_reasoning");

    // two explicit-deep corrections on auto-fast turns teach a new topic
    await drain(loop.runConversation({ text: "check the vibranium shield", source: "test", reasoning: "deep" }));
    await drain(loop.runConversation({ text: "vibranium tolerances again", source: "test", reasoning: "deep" }));
    expect(await tuner.topics()).toContain("vibranium");

    // …and from now on it auto-escalates
    await drain(loop.runConversation({ text: "how is the vibranium doing?", source: "test" }));
    expect(calls[3]!.role).toBe("deep_reasoning");
  });

  it("without a judgment model a correction is honoured but learning is DEFERRED, and the decision says so (D-0080 C2)", async () => {
    const store = fakeStore();
    const tuner = new ReasoningTuner(store, { extractTopics: async () => null });
    const { loop, calls } = convLoop({ deepEligible: true });
    (loop as unknown as { deps: { reasoningTuner?: ReasoningTuner } }).deps.reasoningTuner = tuner;
    const decisions: { mode: string; why: string; role: string }[] = [];
    for (let i = 0; i < 3; i++) {
      await drain(loop.runConversation({
        text: "check the vibranium shield", source: "test", reasoning: "deep",
        onDecision: (d) => decisions.push(d),
      }));
    }
    // the turn itself still runs deep (the user asked), nothing was learned, and the why is honest
    expect(calls.every((c) => c.role === "deep_reasoning")).toBe(true);
    expect(await tuner.topics()).toEqual([]);
    expect(decisions[2]!.why).toContain("once my judgment model is available");
    // a later auto turn on the same subject stays fast — no silent promotion happened
    await drain(loop.runConversation({ text: "how is the vibranium doing?", source: "test" }));
    expect(calls[3]!.role).toBe("fast_conversation");
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

// ---- D-0077: chat delivery of announcements — the conversation is the channel ----

describe("runConversation — announcement relay (D-0077)", () => {
  function announceLoop(pending: { id: string; kind: string; urgency: string; text: string; recommendation: string }[]) {
    const calls: ChatRequest[] = [];
    const delivered: string[] = [];
    const gw = {
      eligibleTargets: () => [{ provider: "p", model: "m" }],
      chatStream: async function* (req: ChatRequest) {
        calls.push(req);
        yield { type: "text_delta", text: "While you were away, sir — noted. Now, your question." };
        yield { type: "done", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } };
        return {
          text: "x", toolCalls: [], finishReason: "stop",
          usage: { inputTokens: 1, outputTokens: 1 }, provider: "p", model: "m", latencyMs: 1,
        };
      },
    } as unknown as GatewayRouter;
    const loop = new CoreLoop({
      gateway: gw, policy: new PolicyEngine(audit, estop), tools: new ToolRegistry(), audit, estop,
      approvals: new ApprovalBroker(audit), activity: new ActivityBus(),
      memory: {} as unknown as MemoryService, toolCtx: { workspaceRoot: "/tmp" },
      announcer: {
        pending: async () => pending,
        markDelivered: async (id: string) => { delivered.push(id); return true; },
      },
    });
    return { loop, calls, delivered };
  }

  it("pending announcements are handed to the model for relay and marked delivered after the turn", async () => {
    const { loop, calls, delivered } = announceLoop([
      { id: "a1", kind: "say", urgency: "advisory", text: "Embeddings provider failing", recommendation: "check ollama" },
      { id: "a2", kind: "concern", urgency: "urgent", text: "Reactor coolant low", recommendation: "" },
    ]);
    const out = await drain(loop.runConversation({ text: "morning", source: "test" }));
    expect(out).toContain("While you were away");
    // the model saw an UNDELIVERED ANNOUNCEMENTS system message with both items
    const sys = calls[0]!.messages.filter((m) => m.role === "system").map((m) => (m as { content: string }).content).join("\n");
    expect(sys).toContain("UNDELIVERED ANNOUNCEMENTS");
    expect(sys).toContain("Embeddings provider failing");
    expect(sys).toContain("Reactor coolant low");
    expect(sys).toContain("concern, urgent");
    // both marked delivered exactly once, after the turn completed
    expect(delivered.sort()).toEqual(["a1", "a2"]);
  });

  it("no pending announcements → no extra system message, nothing marked", async () => {
    const { loop, calls, delivered } = announceLoop([]);
    await drain(loop.runConversation({ text: "morning", source: "test" }));
    const sys = calls[0]!.messages.filter((m) => m.role === "system").map((m) => (m as { content: string }).content).join("\n");
    expect(sys).not.toContain("UNDELIVERED ANNOUNCEMENTS");
    expect(delivered).toEqual([]);
  });

  it("a failing announcer never blocks the conversation", async () => {
    const calls: ChatRequest[] = [];
    const gw = {
      eligibleTargets: () => [{ provider: "p", model: "m" }],
      chatStream: async function* (req: ChatRequest) {
        calls.push(req);
        yield { type: "text_delta", text: "Very well, sir." };
        yield { type: "done", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } };
        return { text: "x", toolCalls: [], finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 }, provider: "p", model: "m", latencyMs: 1 };
      },
    } as unknown as GatewayRouter;
    const loop = new CoreLoop({
      gateway: gw, policy: new PolicyEngine(audit, estop), tools: new ToolRegistry(), audit, estop,
      approvals: new ApprovalBroker(audit), activity: new ActivityBus(),
      memory: {} as unknown as MemoryService, toolCtx: { workspaceRoot: "/tmp" },
      announcer: {
        pending: async () => { throw new Error("db down"); },
        markDelivered: async () => true,
      },
    });
    const out = await drain(loop.runConversation({ text: "hello", source: "test" }));
    expect(out).toBe("Very well, sir.");
  });
});
