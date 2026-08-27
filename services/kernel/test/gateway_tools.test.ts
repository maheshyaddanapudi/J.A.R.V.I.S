import { describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import { GatewayRouter } from "../src/gateway/router.js";
import { gatewayTools, reasoningTools } from "../src/gateway/tools.js";
import { ReasoningTuner, type TunerStore } from "../src/core/reasoning.js";
import { ROLE_OVERRIDES_KEY } from "../src/gateway/overrides.js";
import type { GatewayConfig } from "../src/gateway/schema.js";
import type { MemoryService } from "../src/memory/memory.js";

/**
 * Conversational edit path (D-0055): the runtime overrides are gated TOOLS,
 * so instructing J.A.R.V.I.S. flows through the real loop — a CONSEQUENTIAL
 * re-route needs approval (and a denial means nothing changed), the applied
 * change persists with its ledger, and every change is reversible.
 */

const config: GatewayConfig = {
  providers: {
    localA: { kind: "ollama", baseUrl: "http://127.0.0.1:1", local: true },
    remoteB: { kind: "anthropic", apiKeyEnv: "UNSET", local: false },
  },
  roles: {
    deep_reasoning: [{ provider: "localA", model: "big-local" }],
    local_fallback: [{ provider: "localA", model: "local-model" }],
  },
};

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const estop = {
  get isEngaged() { return false; },
  assertClear() {},
  onChange() { return () => {}; },
} as unknown as EmergencyStop;
const fakePool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as pg.Pool;

function store(): TunerStore & { data: Map<string, string> } {
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

function loopWith(toolsList: ReturnType<typeof gatewayTools>) {
  const tools = new ToolRegistry();
  for (const t of toolsList) tools.register(t);
  const loop = new CoreLoop({
    gateway: {} as GatewayRouter, policy: new PolicyEngine(audit, estop), tools, audit, estop,
    approvals: new ApprovalBroker(audit), activity: new ActivityBus(),
    memory: {} as unknown as MemoryService, toolCtx: { workspaceRoot: "/tmp" },
  });
  return loop;
}

describe("gateway.route / clearRoute as gated tools (D-0055)", () => {
  it("re-routes on approval, persists the delta with its ledger, and clears back", async () => {
    const router = new GatewayRouter(config, fakePool, false);
    const s = store();
    const loop = loopWith(gatewayTools(router, s));

    const res = await loop.runTool({
      tool: "gateway.route",
      args: { role: "deep_reasoning", pins: ["remoteB/claude-sonnet-5@xhigh+thinking"], reason: "spoken instruction" },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(res.ok).toBe(true);
    expect(router.roleTable().deep_reasoning).toEqual(["remoteB/claude-sonnet-5@xhigh+thinking"]);
    // smart persist: the stored value is the DELTA + ledger, not a config copy
    const stored = JSON.parse(s.data.get(ROLE_OVERRIDES_KEY)!);
    expect(stored.deep_reasoning.pins).toEqual(["remoteB/claude-sonnet-5@xhigh+thinking"]);
    expect(stored.deep_reasoning.reason).toBe("spoken instruction");
    expect(Object.keys(stored)).toEqual(["deep_reasoning"]);

    const clear = await loop.runTool({
      tool: "gateway.clearRoute",
      args: { role: "deep_reasoning" },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(clear.ok).toBe(true);
    expect(router.roleTable().deep_reasoning).toEqual(["localA/big-local"]);
    expect(JSON.parse(s.data.get(ROLE_OVERRIDES_KEY)!)).toEqual({});
  });

  it("a DENIED re-route changes nothing", async () => {
    const router = new GatewayRouter(config, fakePool, false);
    const s = store();
    const loop = loopWith(gatewayTools(router, s));
    const res = await loop.runTool({
      tool: "gateway.route",
      args: { role: "deep_reasoning", pins: ["remoteB/m"], reason: "r" },
      source: "test",
      autoApprove: "deny",
    });
    expect(res.ok).toBe(false);
    expect(res.denied).toBe(true);
    expect(router.roleTable().deep_reasoning).toEqual(["localA/big-local"]);
    expect(s.data.has(ROLE_OVERRIDES_KEY)).toBe(false);
  });

  it("an unknown provider fails cleanly through the loop", async () => {
    const router = new GatewayRouter(config, fakePool, false);
    const loop = loopWith(gatewayTools(router, store()));
    const res = await loop.runTool({
      tool: "gateway.route",
      args: { role: "coding", pins: ["nosuch/m"], reason: "r" },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(res.ok).toBe(false);
    expect(res.summary).toContain("unknown provider");
  });
});

describe("reasoning knobs as tools (D-0055)", () => {
  it("teach/forget topic and set threshold flow through the loop, user-sourced", async () => {
    const s = store();
    const tuner = new ReasoningTuner(s);
    const loop = loopWith(reasoningTools(tuner) as ReturnType<typeof gatewayTools>);

    const taught = await loop.runTool({
      tool: "reasoning.teachTopic",
      autoApprove: "allow-once",
      args: { topic: "Vibranium" },
      source: "test",
    });
    expect(taught.ok).toBe(true);
    expect(await tuner.topics()).toEqual(["vibranium"]);

    const thr = await loop.runTool({
      tool: "reasoning.setThreshold",
      autoApprove: "allow-once",
      args: { signalThreshold: 1, reason: "be eager, spoken" },
      source: "test",
    });
    expect(thr.ok).toBe(true);
    expect(await tuner.autotune()).toMatchObject({ signalThreshold: 1, source: "user" });

    const forgot = await loop.runTool({
      tool: "reasoning.forgetTopic",
      autoApprove: "allow-once",
      args: { topic: "vibranium" },
      source: "test",
    });
    expect(forgot.ok).toBe(true);
    expect(await tuner.topics()).toEqual([]);
  });
});
