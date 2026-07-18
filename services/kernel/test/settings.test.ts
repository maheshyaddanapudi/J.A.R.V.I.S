import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { SettingsRegistry, type SettingSpec } from "../src/settings/registry.js";
import { SETTINGS_CATALOG } from "../src/settings/catalog.js";
import { settingsTools } from "../src/settings/tools.js";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { MemoryService } from "../src/memory/memory.js";

/**
 * General runtime settings (D-0058): edit any catalogued knob at runtime,
 * effective = override ?? current default, ledgered, reversible; Z1 core is
 * NOT in the catalog so it cannot be edited here.
 */

const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* skip */
}
const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

const catalog: SettingSpec[] = [
  { key: "t.num", label: "N", category: "Test", type: "number", min: 0, max: 10, default: () => 5, description: "" },
  { key: "t.bool", label: "B", category: "Test", type: "boolean", default: () => true, description: "" },
  { key: "t.enum", label: "E", category: "Test", type: "enum", options: ["a", "b"] as const, default: () => "a", description: "" },
];

afterAll(async () => { await pool?.end(); });

describe.skipIf(!pool)("SettingsRegistry (D-0058)", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE runtime_settings"); });

  it("effective = current default when nothing persisted", async () => {
    const r = new SettingsRegistry(pool!, audit, catalog);
    expect(await r.get("t.num")).toBe(5);
    const eff = await r.effective();
    expect(eff.find((e) => e.key === "t.num")).toMatchObject({ value: 5, default: 5, source: "default" });
  });

  it("set persists a ledgered override; reset returns to default", async () => {
    const r = new SettingsRegistry(pool!, audit, catalog);
    const e = await r.set("t.num", 8, "user", "louder please");
    expect(e).toMatchObject({ value: 8, source: "user", reason: "louder please" });
    expect(await r.get("t.num")).toBe(8);
    // survives a fresh registry instance (persisted, not in-memory)
    expect(await new SettingsRegistry(pool!, audit, catalog).get("t.num")).toBe(8);
    await r.reset("t.num");
    expect(await r.get("t.num")).toBe(5);
  });

  it("validates by type + bounds and rejects unknown keys", async () => {
    const r = new SettingsRegistry(pool!, audit, catalog);
    await expect(r.set("t.num", 99, "user", "x")).rejects.toThrow(/max/);
    await expect(r.set("t.num", "nope", "user", "x")).rejects.toThrow(/number/);
    await expect(r.set("t.enum", "z", "user", "x")).rejects.toThrow(/one of/);
    await expect(r.set("t.bool", "true", "user", "x")).resolves.toMatchObject({ value: true });
    await expect(r.set("nope.key", 1, "user", "x")).rejects.toThrow(/unknown setting/);
  });

  it("the SHIPPED catalog excludes every Z1 trust-core concern (R-CAP-08)", () => {
    const forbidden = /policy|approval|audit|estop|e-stop|credential|secret|vault|sandbox/i;
    for (const s of SETTINGS_CATALOG) expect(s.key).not.toMatch(forbidden);
    // and it is non-empty (proactivity gates registered)
    expect(SETTINGS_CATALOG.some((s) => s.key.startsWith("proactive."))).toBe(true);
  });

  it("DYNAMIC settings (D-0060): register → surfaced+editable+deletable; survives a fresh instance", async () => {
    await pool!.query("TRUNCATE setting_specs");
    const r = new SettingsRegistry(pool!, audit, catalog);
    await r.init();
    const reg = await r.register(
      { key: "arc.reactor.output", label: "Arc output", type: "number", default: 40, min: 0, max: 100, category: "Discovered" },
      "jarvis",
    );
    expect(reg).toMatchObject({ origin: "dynamic", removable: true, value: 40 });
    // editable like any setting
    await r.set("arc.reactor.output", 88, "user", "ramp up");
    expect(await r.get("arc.reactor.output")).toBe(88);
    // a FRESH instance (restart) re-loads the dynamic spec
    const r2 = new SettingsRegistry(pool!, audit, catalog);
    await r2.init();
    expect(r2.has("arc.reactor.output")).toBe(true);
    expect(await r2.get("arc.reactor.output")).toBe(88); // override persisted too
    // dynamic settings are fully deletable
    const del = await r2.remove("arc.reactor.output");
    expect(del.action).toBe("deleted");
    expect(r2.has("arc.reactor.output")).toBe(false);
  });

  it("SYSTEM settings are the floor: 'delete' resets to default, never removes them", async () => {
    const r = new SettingsRegistry(pool!, audit, catalog);
    await r.init();
    await r.set("t.num", 9, "user", "x");
    const del = await r.remove("t.num");
    expect(del.action).toBe("reset");
    expect(r.has("t.num")).toBe(true);          // still present (floor)
    expect(await r.get("t.num")).toBe(5);        // default kicked back in
  });

  it("register refuses Z1 keys and system-key collisions", async () => {
    const r = new SettingsRegistry(pool!, audit, catalog);
    await r.init();
    await expect(r.register({ key: "approval.bypass", label: "x", type: "boolean", default: true }, "jarvis")).rejects.toThrow(/protected/);
    await expect(r.register({ key: "t.num", label: "x", type: "number", default: 1 }, "jarvis")).rejects.toThrow(/system setting/);
  });
});

// ---- gated tool round-trip through the real loop ----
const estop = { get isEngaged() { return false; }, assertClear() {}, onChange() { return () => {}; } } as unknown as EmergencyStop;

describe.skipIf(!pool)("settings.set / reset as gated tools (D-0058)", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE runtime_settings"); });

  it("J.A.R.V.I.S. edits a setting through policy→approval→audit; deny changes nothing", async () => {
    const r = new SettingsRegistry(pool!, audit, catalog);
    const tools = new ToolRegistry();
    for (const t of settingsTools(r)) tools.register(t);
    const loop = new CoreLoop({
      gateway: {} as GatewayRouter, policy: new PolicyEngine(audit, estop), tools, audit, estop,
      approvals: new ApprovalBroker(audit), activity: new ActivityBus(),
      memory: {} as unknown as MemoryService, toolCtx: { workspaceRoot: "/tmp" },
    });
    // CONSEQUENTIAL → denied leaves the default
    const denied = await loop.runTool({ tool: "settings.set", args: { key: "t.num", value: 9, reason: "r" }, source: "test", autoApprove: "deny" });
    expect(denied.denied).toBe(true);
    expect(await r.get("t.num")).toBe(5);
    // approved applies + persists + is reversible
    const ok = await loop.runTool({ tool: "settings.set", args: { key: "t.num", value: 9, reason: "eager" }, source: "test", autoApprove: "allow-once" });
    expect(ok.ok).toBe(true);
    expect(await r.get("t.num")).toBe(9);
    const reset = await loop.runTool({ tool: "settings.reset", args: { key: "t.num" }, source: "test", autoApprove: "allow-once" });
    expect(reset.ok).toBe(true);
    expect(await r.get("t.num")).toBe(5);
  });
});
