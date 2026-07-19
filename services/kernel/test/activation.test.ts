import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { CapabilityRegistry } from "../src/selfext/registry.js";
import { CapabilityGuard } from "../src/selfext/guard.js";
import { ActivationService, activationTools, type StepRunner } from "../src/selfext/activation.js";
import { ToolRegistry, type Tool } from "../src/core/tools.js";
import type { RiskClass } from "../src/core/policy.js";
import type { CapabilityManifest, CompositionStep } from "../src/selfext/protected.js";
import type { AuditLog } from "../src/core/audit.js";

/**
 * Stage-B controlled activation (D-0073). An approved, Stage-A-generated
 * capability activates as a `capability:<name>` gated tool that COMPOSES existing
 * gated tools — never manifest code, never Z1. The R-CAP-08 envelope is
 * re-validated at activation: a rejected capability can never activate; a
 * composition may not call the selfext / capability namespaces or an unknown tool.
 */
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

function stub(name: string, riskClass: RiskClass): Tool {
  return {
    name, description: name, riskClass, action: name,
    inputSchema: { type: "object", additionalProperties: true },
    async run() { return { ok: true, summary: `stub ${name}` }; },
  };
}

function seededTools(): ToolRegistry {
  const t = new ToolRegistry();
  t.register(stub("perceive.observe", "READ_ONLY"));
  t.register(stub("notify.announce", "LOW_REVERSIBLE"));
  return t;
}

describe.skipIf(!pool)("Stage-B activation (D-0073)", () => {
  let registry: CapabilityRegistry;
  const guard = new CapabilityGuard(audit);

  beforeEach(async () => {
    await pool!.query("TRUNCATE capabilities, capability_gaps CASCADE");
    registry = new CapabilityRegistry(pool!, audit);
  });

  async function seed(
    name: string,
    composition: CompositionStep[],
    opts?: { protectedFile?: boolean; permissions?: string[] },
  ): Promise<void> {
    const m: CapabilityManifest = {
      name, version: "0.1.0", riskClass: "LOW_REVERSIBLE",
      permissions: opts?.permissions ?? [],
      files: opts?.protectedFile
        ? [{ path: "services/kernel/src/core/policy.ts", op: "modify", content: "// evil" }]
        : [],
      composition,
    };
    const verdict = await guard.scan(m);
    await registry.recordStageA(m, verdict, {}, {});
  }

  function activationWith(tools: ToolRegistry, runner?: StepRunner) {
    const calls: { tool: string; args: unknown }[] = [];
    const defaultRunner: StepRunner = {
      runTool: async (i) => { calls.push({ tool: i.tool, args: i.args }); return { ok: true, summary: `ran ${i.tool}` }; },
    };
    return { svc: new ActivationService(registry, tools, runner ?? defaultRunner, audit), calls };
  }

  it("activates a clean capability → a gated capability:<name> tool that runs the composition in order", async () => {
    await seed("morning-brief", [
      { tool: "perceive.observe" },
      { tool: "notify.announce", args: { text: "good morning" } },
    ]);
    const tools = seededTools();
    const { svc, calls } = activationWith(tools);
    const r = await svc.activate("morning-brief", "0.1.0");
    expect(r.ok).toBe(true);
    expect(tools.has("capability:morning-brief")).toBe(true);
    // registry state advanced to active
    expect((await registry.record("morning-brief", "0.1.0"))!.state).toBe("active");
    // running the composed tool drives each step through the gated runner, in order
    const cap = tools.get("capability:morning-brief")!;
    const res = await cap.run({}, {} as never);
    expect(res.ok).toBe(true);
    expect(calls.map((c) => c.tool)).toEqual(["perceive.observe", "notify.announce"]);
    // the declared static arg reaches the step (composition is authoritative)
    expect(calls[1]!.args).toMatchObject({ text: "good morning" });
  });

  it("REFUSES to activate a hard-limit-REJECTED capability (terminal) — no tool appears", async () => {
    await seed("evil", [{ tool: "perceive.observe" }], { protectedFile: true });
    const tools = seededTools();
    const { svc } = activationWith(tools);
    const r = await svc.activate("evil", "0.1.0");
    expect(r.ok).toBe(false);
    expect((r.reasons ?? []).join(" ")).toMatch(/reject|hard-limit/i);
    expect(tools.has("capability:evil")).toBe(false);
    expect((await registry.record("evil", "0.1.0"))!.state).toBe("scanned_rejected");
  });

  it("REFUSES a composition that calls the self-extension machinery or capability:* (recursion/privilege)", async () => {
    const tools = seededTools();
    const { svc } = activationWith(tools);
    for (const bad of ["selfext.activate", "capability:other", "settings.register", "gateway.route"]) {
      await seed(`recursor-${bad.replace(/\W/g, "")}`, [{ tool: bad }]);
      const r = await svc.activate(`recursor-${bad.replace(/\W/g, "")}`, "0.1.0");
      expect(r.ok, bad).toBe(false);
      expect((r.reasons ?? []).join(" "), bad).toMatch(/denylist/i);
    }
  });

  it("REFUSES a composition referencing an unknown tool", async () => {
    await seed("ghost", [{ tool: "does.not.exist" }]);
    const tools = seededTools();
    const { svc } = activationWith(tools);
    const r = await svc.activate("ghost", "0.1.0");
    expect(r.ok).toBe(false);
    expect((r.reasons ?? []).join(" ")).toMatch(/unknown tool/i);
  });

  it("REFUSES a capability requesting a protected permission (re-validated at activation)", async () => {
    await seed("sneaky", [{ tool: "perceive.observe" }], { permissions: ["credential:read"] });
    const tools = seededTools();
    const { svc } = activationWith(tools);
    const r = await svc.activate("sneaky", "0.1.0");
    expect(r.ok).toBe(false);
    expect((r.reasons ?? []).join(" ")).toMatch(/credential:read/);
  });

  it("HALTS the composition when a composed step is denied — later steps do not run", async () => {
    await seed("halter", [{ tool: "perceive.observe" }, { tool: "notify.announce" }]);
    const tools = seededTools();
    const denyRunner: StepRunner = {
      runTool: async (i) =>
        i.tool === "notify.announce"
          ? { ok: false, denied: true, summary: "denied by user" }
          : { ok: true, summary: "ran" },
    };
    const { svc } = activationWith(tools, denyRunner);
    await svc.activate("halter", "0.1.0");
    const res = await tools.get("capability:halter")!.run({}, {} as never);
    expect(res.ok).toBe(false);
    expect(res.summary).toMatch(/halted at step 2/);
  });

  it("deactivate removes the tool + disables it; restoreActive re-registers active caps after a restart", async () => {
    await seed("morning-brief", [{ tool: "perceive.observe" }]);
    const tools = seededTools();
    const { svc } = activationWith(tools);
    await svc.activate("morning-brief", "0.1.0");
    expect(await svc.deactivate("morning-brief", "0.1.0")).toBe(true);
    expect(tools.has("capability:morning-brief")).toBe(false);
    expect((await registry.record("morning-brief", "0.1.0"))!.state).toBe("disabled");

    // re-activate, then simulate a restart with a fresh tool registry
    await svc.activate("morning-brief", "0.1.0");
    const tools2 = seededTools();
    const { svc: svc2 } = activationWith(tools2);
    const restored = await svc2.restoreActive();
    expect(restored.restored).toBeGreaterThanOrEqual(1);
    expect(tools2.has("capability:morning-brief")).toBe(true);
  });

  it("restoreActive SKIPS (never crashes on) an active cap whose composed tool has since disappeared", async () => {
    await seed("orphan", [{ tool: "perceive.observe" }]);
    const tools = seededTools();
    const { svc } = activationWith(tools);
    await svc.activate("orphan", "0.1.0");
    // a fresh registry that no longer has perceive.observe registered
    const tools2 = new ToolRegistry();
    const { svc: svc2 } = activationWith(tools2);
    const restored = await svc2.restoreActive();
    expect(restored.restored).toBe(0);
    expect(restored.skipped.join(" ")).toMatch(/orphan/);
    expect(tools2.has("capability:orphan")).toBe(false);
  });

  it("selfext.propose raises an announcement + agenda and does NOT activate (heartbeat-safe, LOW_REVERSIBLE)", async () => {
    await seed("weather", [{ tool: "perceive.observe" }]);
    const tools = seededTools();
    const { svc } = activationWith(tools);
    const announced: unknown[] = [];
    const agendaAdded: unknown[] = [];
    const acts = activationTools(svc, registry, {
      announce: async (i) => { announced.push(i); return {}; },
      addAgenda: async (i) => { agendaAdded.push(i); return { id: "ag-1" }; },
    });
    const propose = acts.find((t) => t.name === "selfext.propose")!;
    expect(propose.riskClass).toBe("LOW_REVERSIBLE"); // a heartbeat can propose but not activate
    const r = await propose.run({ name: "weather", rationale: "you check it every morning" }, {} as never);
    expect(r.ok).toBe(true);
    expect(announced).toHaveLength(1);
    expect(agendaAdded).toHaveLength(1);
    expect(tools.has("capability:weather")).toBe(false);
    expect((await registry.record("weather", "0.1.0"))!.state).toBe("awaiting_review");

    // and the activate tool is CONSEQUENTIAL — activation itself needs approval
    const activate = acts.find((t) => t.name === "selfext.activate")!;
    expect(activate.riskClass).toBe("CONSEQUENTIAL");
  });
});
