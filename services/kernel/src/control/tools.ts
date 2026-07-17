import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import type { ComputerControl, ElementSelector } from "./contract.js";

/**
 * Computer-control tools, policy-gated (R-CTRL-03/04, R-AUTO). Read-only
 * inspection runs automatically; every mutating action is CONSEQUENTIAL — it
 * carries a pre-action disclosure and is approval-gated, audited, and
 * independently verifiable. Semantic-first: selectors use AX identifiers; a
 * coordinate fallback is surfaced in the result (`usedCoordinates`).
 *
 * The bound `ComputerControl` is the SIMULATION adapter in-container and the
 * real macOS adapter on the Mac — identical typed contract, so these tools and
 * their policy/audit behavior are verified here and unchanged on hardware.
 *
 * NB (R-VER check-in): wiring the REAL macOS adapter as the backend requires the
 * "before enabling computer control" check-in (docs/06). In-container these
 * tools drive the SIMULATION adapter only; provenance is surfaced on every call.
 */
export function computerControlTools(control: ComputerControl): Tool[] {
  const provTag = control.provenance === "SIMULATION" ? " [SIMULATION]" : "";

  const listApps: Tool = {
    name: "control.listApps",
    description: `List running applications${provTag}.`,
    riskClass: "READ_ONLY",
    action: "inspect running applications",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const apps = await control.listApps();
      return {
        ok: true,
        summary: `${apps.length} apps (${control.provenance}): ${apps.map((a) => a.name).join(", ")}`,
        data: { provenance: control.provenance, apps },
      };
    },
  };

  const uiTree: Tool = {
    name: "control.uiTree",
    description: `Inspect the accessibility UI tree of a window${provTag}.`,
    riskClass: "READ_ONLY",
    action: "inspect UI accessibility tree",
    inputSchema: {
      type: "object",
      properties: { windowId: { type: "number" } },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { windowId } = (args ?? {}) as { windowId?: number };
      const tree = await control.uiTree(windowId);
      const count = countElements(tree);
      return {
        ok: true,
        summary: `AX tree (${control.provenance}): ${count} elements under '${tree.title ?? tree.role}'`,
        data: { provenance: control.provenance, tree },
      };
    },
  };

  const screenshot: Tool = {
    name: "control.screenshot",
    description: `Capture a window screenshot${provTag}.`,
    riskClass: "READ_ONLY",
    action: "capture screen",
    inputSchema: {
      type: "object",
      properties: { windowId: { type: "number" } },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { windowId } = (args ?? {}) as { windowId?: number };
      const shot = await control.screenshot(windowId);
      return {
        ok: true,
        summary: `${shot.width}x${shot.height} capture (${shot.provenance})`,
        data: { provenance: shot.provenance, width: shot.width, height: shot.height },
      };
    },
  };

  const pressElement: Tool = {
    name: "control.pressElement",
    description: `Press/click a UI element selected semantically (AX identifier/title)${provTag}. Consequential.`,
    riskClass: "CONSEQUENTIAL",
    action: "activate a UI control",
    inputSchema: {
      type: "object",
      properties: {
        windowId: { type: "number" },
        identifier: { type: "string" },
        title: { type: "string" },
        role: { type: "string" },
        path: { type: "string" },
        point: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
        },
        action: { type: "string", default: "AXPress" },
      },
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as ElementSelector & { action?: string };
      const target = a.identifier ?? a.title ?? a.path ?? (a.point ? `point(${a.point.x},${a.point.y})` : "?");
      return {
        whatWillHappen: `Perform ${a.action ?? "AXPress"} on UI element '${target}'.`,
        affected: [`window ${a.windowId ?? "focused"}`],
        proposedCommands: [`AX ${a.action ?? "AXPress"} → ${target}`],
        reason: "User asked J.A.R.V.I.S. to operate an application control.",
        riskClass: "CONSEQUENTIAL",
        reversible: false,
        rollbackPlan: "UI actions are not generally reversible; effect is observed and verified after.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as ElementSelector & { action?: string };
      const selector: ElementSelector = {};
      if (a.windowId !== undefined) selector.windowId = a.windowId;
      if (a.identifier) selector.identifier = a.identifier;
      if (a.title) selector.title = a.title;
      if (a.role) selector.role = a.role;
      if (a.path) selector.path = a.path;
      if (a.point) selector.point = a.point;
      const res = await control.performAction(selector, a.action ?? "AXPress");
      return {
        ok: res.ok,
        summary: `${res.summary}${res.usedCoordinates ? " [coordinate fallback]" : ""} (${res.provenance})`,
        data: res,
      };
    },
  };

  const setValue: Tool = {
    name: "control.setValue",
    description: `Set a text field's value semantically${provTag}. Consequential.`,
    riskClass: "CONSEQUENTIAL",
    action: "set a UI field value",
    inputSchema: {
      type: "object",
      properties: {
        windowId: { type: "number" },
        identifier: { type: "string" },
        title: { type: "string" },
        value: { type: "string" },
      },
      required: ["value"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as ElementSelector & { value: string };
      return {
        whatWillHappen: `Set field '${a.identifier ?? a.title ?? "?"}' to ${a.value.length} chars.`,
        affected: [`window ${a.windowId ?? "focused"}`],
        proposedCommands: [`AXValue set → ${a.identifier ?? a.title}`],
        reason: "User asked J.A.R.V.I.S. to fill in a field.",
        riskClass: "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "Prior value captured before write; restore on rollback.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as ElementSelector & { value: string };
      const selector: ElementSelector = {};
      if (a.windowId !== undefined) selector.windowId = a.windowId;
      if (a.identifier) selector.identifier = a.identifier;
      if (a.title) selector.title = a.title;
      const res = await control.setValue(selector, a.value);
      return { ok: res.ok, summary: `${res.summary} (${res.provenance})`, data: res };
    },
  };

  return [listApps, uiTree, screenshot, pressElement, setValue];
}

function countElements(el: { children: { children: unknown[] }[] }): number {
  let n = 1;
  for (const c of el.children as { children: unknown[] }[]) {
    n += countElements(c as { children: { children: unknown[] }[] });
  }
  return n;
}
