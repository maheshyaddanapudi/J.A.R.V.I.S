import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import { DEVICE_RISK, type DeviceGateway, type DeviceType } from "./contract.js";
import type { InterlockManager } from "./interlock.js";

/**
 * Device-control tools, policy-gated (R-AUTO physical rules). Reading device
 * state is READ_ONLY; commanding a light/media/climate device is CONSEQUENTIAL
 * (approval + audit + verification); commanding a lock/garage/utility is
 * HIGH_RISK_PHYSICAL (per-action approval PLUS an armed hardware interlock).
 *
 * The bound gateway is the Stark-residence SIMULATION adapter in-container and
 * the real Home Assistant adapter on the Mac — identical contract, so the tools
 * and their gating are verified here and unchanged on real hardware.
 *
 * GATE (docs/06): binding the REAL gateway requires the "before enabling
 * physical-device control" check-in (D-0025). In-container the SIMULATION
 * gateway is used; provenance is surfaced on every call.
 */
export function deviceTools(gateway: DeviceGateway, interlock: InterlockManager): Tool[] {
  const tag = gateway.provenance === "SIMULATION" ? " [SIMULATION]" : "";

  const listDevices: Tool = {
    name: "device.list",
    description: `List connected devices and rooms${tag}.`,
    riskClass: "READ_ONLY",
    action: "inspect connected devices",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const devices = await gateway.listDevices();
      return {
        ok: true,
        summary: `${devices.length} devices (${gateway.provenance})`,
        data: { provenance: gateway.provenance, devices },
      };
    },
  };

  const getState: Tool = {
    name: "device.state",
    description: `Read a device's current state${tag}.`,
    riskClass: "READ_ONLY",
    action: "read device state",
    inputSchema: {
      type: "object",
      properties: { deviceId: { type: "string" } },
      required: ["deviceId"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { deviceId } = args as { deviceId: string };
      const state = await gateway.getState(deviceId);
      if (!state) return { ok: false, summary: `no device '${deviceId}'` };
      return {
        ok: true,
        summary: `${deviceId} (${state.provenance}): ${JSON.stringify(state.attributes)}`,
        data: state,
      };
    },
  };

  const setDevice: Tool = {
    name: "device.set",
    description: `Command a device (set attributes)${tag}. Consequential; locks/garage/utilities are high-risk physical and need an armed interlock.`,
    // We declare CONSEQUENTIAL statically; the loop's disclosure + this tool's
    // own interlock check enforce the HIGH_RISK_PHYSICAL rule per device.
    riskClass: "CONSEQUENTIAL",
    action: "command a physical device",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string" },
        set: { type: "object" },
      },
      required: ["deviceId", "set"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as { deviceId: string; set: Record<string, unknown> };
      const highRisk = isHighRisk(a.deviceId);
      return {
        whatWillHappen: `Set ${a.deviceId} → ${JSON.stringify(a.set)}.`,
        affected: [a.deviceId],
        proposedCommands: [`${a.deviceId}.set(${JSON.stringify(a.set)})`],
        reason: "User asked J.A.R.V.I.S. to control a device.",
        riskClass: highRisk ? "HIGH_RISK_PHYSICAL" : "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "Prior attribute values captured before the command; restore on rollback.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { deviceId: string; set: Record<string, string | number | boolean> };

      // HIGH_RISK_PHYSICAL: require an armed interlock IN ADDITION to the
      // approval the loop already obtained (R-AUTO-01).
      if (isHighRisk(a.deviceId)) {
        const now = Date.now();
        const ok = await interlock.consume(a.deviceId, now);
        if (!ok) {
          return {
            ok: false,
            summary: `refused: ${a.deviceId} is HIGH_RISK_PHYSICAL — arm the hardware interlock first (device.armInterlock)`,
          };
        }
      }

      // capture prior state for rollback
      const before = await gateway.getState(a.deviceId);
      const result = await gateway.apply({ deviceId: a.deviceId, set: a.set });
      if (!result.ok) return { ok: false, summary: result.summary };

      const rollback = before
        ? async () => {
            await gateway.apply({ deviceId: a.deviceId, set: before.attributes });
          }
        : undefined;

      return {
        ok: true,
        summary: `${result.summary} (${result.provenance})`,
        data: result.observed,
        ...(rollback ? { rollback } : {}),
      };
    },
  };

  const armInterlock: Tool = {
    name: "device.armInterlock",
    description: `Arm the hardware interlock for a high-risk device for 30s${tag}. Low-risk, reversible.`,
    riskClass: "LOW_REVERSIBLE",
    action: "arm device hardware interlock",
    inputSchema: {
      type: "object",
      properties: { deviceId: { type: "string" } },
      required: ["deviceId"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { deviceId } = args as { deviceId: string };
      if (!isHighRisk(deviceId)) {
        return { ok: true, summary: `${deviceId} is not high-risk; no interlock needed` };
      }
      const { expiresAt } = await interlock.arm(deviceId, Date.now());
      return {
        ok: true,
        summary: `interlock armed for ${deviceId} (${Math.round((expiresAt - Date.now()) / 1000)}s)`,
        rollback: async () => {
          /* interlock expires on its own; nothing to undo */
        },
      };
    },
  };

  return [listDevices, getState, setDevice, armInterlock];
}

const HIGH_RISK_PREFIXES: DeviceType[] = ["lock", "garage", "utility"];
function isHighRisk(deviceId: string): boolean {
  const type = deviceId.split(".")[0] as DeviceType;
  return HIGH_RISK_PREFIXES.includes(type) && DEVICE_RISK[type] === "HIGH_RISK_PHYSICAL";
}
