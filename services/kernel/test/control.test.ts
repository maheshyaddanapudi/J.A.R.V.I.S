import { describe, expect, it } from "vitest";
import { SimulatedDesktop } from "../src/control/simulator.js";

/**
 * Computer-control SIMULATION adapter tests. The simulator is a real, mutable
 * virtual desktop — verification observes actual state change, exactly as the
 * macOS adapter observes AX state.
 */
describe("SimulatedDesktop (SIMULATION control adapter)", () => {
  it("labels everything SIMULATION", async () => {
    const d = new SimulatedDesktop();
    expect(d.provenance).toBe("SIMULATION");
    expect((await d.screenshot()).provenance).toBe("SIMULATION");
    expect((await d.readClipboard()).provenance).toBe("SIMULATION");
    expect((await d.activateApp(1001)).provenance).toBe("SIMULATION");
  });

  it("lists apps and windows with a frontmost app", async () => {
    const d = new SimulatedDesktop();
    const apps = await d.listApps();
    expect(apps.map((a) => a.name)).toContain("Notes");
    expect(apps.filter((a) => a.frontmost)).toHaveLength(1);
    const windows = await d.listWindows();
    expect(windows.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes an AX tree with roles, identifiers, and actions", async () => {
    const d = new SimulatedDesktop();
    const tree = await d.uiTree(1);
    expect(tree.role).toBe("AXWindow");
    const save = tree.children.find((c) => c.identifier === "save");
    expect(save?.role).toBe("AXButton");
    expect(save?.actions).toContain("AXPress");
  });

  it("performs a semantic AXPress and the effect is observable (verification)", async () => {
    const d = new SimulatedDesktop();
    expect(d.wasSaved).toBe(false);
    const res = await d.performAction({ windowId: 1, identifier: "save" }, "AXPress");
    expect(res.ok).toBe(true);
    expect(res.usedCoordinates).toBe(false);
    expect(d.wasSaved).toBe(true); // real state change in the virtual desktop
  });

  it("toggles a checkbox via AXPress and the value flips", async () => {
    const d = new SimulatedDesktop();
    const before = (await d.uiTree(2)).children.find((c) => c.identifier === "dark-mode")!.value;
    await d.performAction({ windowId: 2, identifier: "dark-mode" }, "AXPress");
    const after = (await d.uiTree(2)).children.find((c) => c.identifier === "dark-mode")!.value;
    expect(before).toBe("0");
    expect(after).toBe("1");
  });

  it("setValue changes a field and is verifiable", async () => {
    const d = new SimulatedDesktop();
    await d.setValue({ windowId: 1, identifier: "note-body" }, "Buy milk");
    const field = (await d.uiTree(1)).children.find((c) => c.identifier === "note-body");
    expect(field?.value).toBe("Buy milk");
  });

  it("typeText appends to the focused element", async () => {
    const d = new SimulatedDesktop();
    await d.typeText("hello");
    await d.typeText(" world");
    const field = (await d.uiTree(1)).children.find((c) => c.identifier === "note-body");
    expect(field?.value).toBe("hello world");
  });

  it("clipboard round-trips", async () => {
    const d = new SimulatedDesktop();
    await d.writeClipboard("copied text");
    expect((await d.readClipboard()).text).toBe("copied text");
  });

  it("flags coordinate fallback when addressing by point", async () => {
    const d = new SimulatedDesktop();
    // the Save button is around x540 y20 in window 1 (frontmost)
    const res = await d.performAction({ point: { x: 560, y: 30 } }, "AXPress");
    expect(res.ok).toBe(true);
    expect(res.usedCoordinates).toBe(true);
  });

  it("fails cleanly on a missing element", async () => {
    const d = new SimulatedDesktop();
    const res = await d.performAction({ identifier: "does-not-exist" }, "AXPress");
    expect(res.ok).toBe(false);
  });
});
