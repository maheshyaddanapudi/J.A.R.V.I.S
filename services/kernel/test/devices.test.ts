import { describe, expect, it, vi } from "vitest";
import { StarkResidence } from "../src/devices/simulator.js";
import { InterlockManager } from "../src/devices/interlock.js";
import { deviceTools } from "../src/devices/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { ToolContext } from "../src/core/tools.js";

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const ctx: ToolContext = { workspaceRoot: "/tmp" };

describe("StarkResidence (SIMULATION device gateway)", () => {
  it("labels everything SIMULATION and lists rooms/devices", async () => {
    const home = new StarkResidence();
    expect(home.provenance).toBe("SIMULATION");
    const devices = await home.listDevices();
    expect(devices.some((d) => d.id === "light.workshop")).toBe(true);
    expect(devices.some((d) => d.type === "lock")).toBe(true);
    expect((await home.getState("light.workshop"))?.provenance).toBe("SIMULATION");
  });

  it("applies a command and the state actually changes (verification)", async () => {
    const home = new StarkResidence();
    const res = await home.apply({ deviceId: "light.workshop", set: { on: true, brightness: 70 } });
    expect(res.ok).toBe(true);
    expect(res.observed?.attributes).toMatchObject({ on: true, brightness: 70 });
    expect((await home.getState("light.workshop"))?.attributes.on).toBe(true);
  });

  it("rejects unsupported capabilities", async () => {
    const home = new StarkResidence();
    const res = await home.apply({ deviceId: "light.workshop", set: { temperature: 5 } });
    expect(res.ok).toBe(false);
  });
});

describe("InterlockManager", () => {
  it("arms, consumes once, and denies when not armed or expired", async () => {
    const il = new InterlockManager(audit, 1000);
    const now = 10_000;
    expect(await il.consume("lock.front", now)).toBe(false); // not armed
    await il.arm("lock.front", now);
    expect(il.isArmed("lock.front", now)).toBe(true);
    expect(await il.consume("lock.front", now)).toBe(true); // consumed
    expect(await il.consume("lock.front", now)).toBe(false); // single-use
    await il.arm("lock.front", now);
    expect(await il.consume("lock.front", now + 2000)).toBe(false); // expired
  });
});

describe("device tools gating (HIGH_RISK_PHYSICAL + interlock)", () => {
  function setup() {
    const home = new StarkResidence();
    const il = new InterlockManager(audit, 30_000);
    const tools = deviceTools(home, il);
    const byName = new Map(tools.map((t) => [t.name, t]));
    return { home, il, byName };
  }

  it("light is CONSEQUENTIAL and runs without an interlock", async () => {
    const { byName } = setup();
    const setTool = byName.get("device.set")!;
    expect(setTool.riskClass).toBe("CONSEQUENTIAL");
    const res = await setTool.run({ deviceId: "light.workshop", set: { on: true } }, ctx);
    expect(res.ok).toBe(true);
  });

  it("lock discloses HIGH_RISK_PHYSICAL", async () => {
    const { byName } = setup();
    const setTool = byName.get("device.set")!;
    const disclosure = setTool.disclose!({ deviceId: "lock.front", set: { locked: false } }, ctx);
    expect(disclosure.riskClass).toBe("HIGH_RISK_PHYSICAL");
  });

  it("REFUSES a lock command when the interlock is not armed", async () => {
    const { byName } = setup();
    const setTool = byName.get("device.set")!;
    const res = await setTool.run({ deviceId: "lock.front", set: { locked: false } }, ctx);
    expect(res.ok).toBe(false);
    expect(res.summary).toMatch(/interlock/i);
  });

  it("ALLOWS a lock command after the interlock is armed, then requires re-arming", async () => {
    const { byName } = setup();
    const arm = byName.get("device.armInterlock")!;
    const setTool = byName.get("device.set")!;
    await arm.run({ deviceId: "lock.front" }, ctx);
    const ok = await setTool.run({ deviceId: "lock.front", set: { locked: false } }, ctx);
    expect(ok.ok).toBe(true);
    // interlock is single-use — a second command must re-arm
    const again = await setTool.run({ deviceId: "lock.front", set: { locked: true } }, ctx);
    expect(again.ok).toBe(false);
  });

  it("light command captures a rollback that restores prior state", async () => {
    const { home, byName } = setup();
    const setTool = byName.get("device.set")!;
    await home.apply({ deviceId: "light.living", set: { on: false } });
    const res = await setTool.run({ deviceId: "light.living", set: { on: true } }, ctx);
    expect(res.rollback).toBeDefined();
    await res.rollback!();
    expect((await home.getState("light.living"))?.attributes.on).toBe(false);
  });
});
