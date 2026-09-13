import { describe, expect, it, vi } from "vitest";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry, type Tool } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { MemoryService } from "../src/memory/memory.js";

/**
 * tools.validateArgs experiment (2026-08-29): schema-check tool args at the
 * loop boundary, BEHIND A FLAG that defaults off. Off = today's behavior (a
 * malformed call fails inside the tool body and the loop contains it); on =
 * a clean, field-level refusal BEFORE disclosure/policy/approval. The flag's
 * default is decided by measurement — these tests pin both behaviors.
 */

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const estop = {
  get isEngaged() { return false; },
  assertClear() {},
  onChange() { return () => {}; },
} as unknown as EmergencyStop;

// a tool that (like memory.rememberFact) reads a required string field with
// no defensive check of its own — the crash surface the flag protects
const brittle: Tool = {
  name: "test.brittle",
  description: "reads args.statement without checking",
  riskClass: "READ_ONLY",
  action: "test",
  inputSchema: {
    type: "object",
    properties: { statement: { type: "string" } },
    required: ["statement"],
    additionalProperties: false,
  },
  async run(args: unknown) {
    const a = args as { statement: string };
    return { ok: true, summary: `got: ${a.statement.trim()}` };
  },
};

function makeLoop(flag: boolean) {
  const tools = new ToolRegistry();
  tools.register(brittle);
  return new CoreLoop({
    gateway: {} as unknown as GatewayRouter,
    policy: new PolicyEngine(audit, estop),
    approvals: new ApprovalBroker(audit),
    activity: new ActivityBus(),
    tools,
    audit,
    estop,
    memory: {} as unknown as MemoryService,
    toolCtx: {},
    validateArgs: async () => flag,
  });
}

describe("tools.validateArgs — the arg-validation flag", () => {
  it("flag OFF (default): malformed args reach the tool; the loop contains the crash as ok:false", async () => {
    const res = await makeLoop(false).runTool({ tool: "test.brittle", args: { fact: "x" }, source: "test" });
    expect(res.ok).toBe(false);
    expect(res.summary).toMatch(/Cannot read properties/); // the raw contained error — today's behavior
  });

  it("flag ON: malformed args are refused cleanly with the field-level reason, before the tool runs", async () => {
    const res = await makeLoop(true).runTool({ tool: "test.brittle", args: { fact: "x" }, source: "test" });
    expect(res.ok).toBe(false);
    expect(res.summary).toContain("invalid args for test.brittle");
    expect(res.summary).toMatch(/statement|additional properties/); // actionable, names the problem
  });

  it("flag ON: valid args pass through untouched", async () => {
    const res = await makeLoop(true).runTool({ tool: "test.brittle", args: { statement: " hi " }, source: "test" });
    expect(res.ok).toBe(true);
    expect(res.summary).toBe("got: hi");
  });

  it("flag ON: an uncompilable schema never blocks the tool (fail-open on our own bug)", async () => {
    const tools = new ToolRegistry();
    tools.register({ ...brittle, name: "test.badschema", inputSchema: { type: "not-a-type" } });
    const loop = new CoreLoop({
      gateway: {} as unknown as GatewayRouter,
      policy: new PolicyEngine(audit, estop),
      approvals: new ApprovalBroker(audit),
      activity: new ActivityBus(),
      tools, audit, estop,
      memory: {} as unknown as MemoryService,
      toolCtx: {},
      validateArgs: async () => true,
    });
    const res = await loop.runTool({ tool: "test.badschema", args: { statement: "ok" }, source: "test" });
    expect(res.ok).toBe(true);
  });
});
