/**
 * Device-control hardware-abstraction layer (R-HW, R-AUTO physical rules).
 *
 * Typed contract every device backend implements. Backends (honesty rule):
 *   - StarkResidence — labeled SIMULATION over a virtual home; runs in the
 *     container/CI, provenance = "SIMULATION", never presented as real devices.
 *   - HomeAssistant  — real adapter (REST/WebSocket to the user's HA); source in
 *     devices/homeassistant.ts. Reaches real devices ONLY on the user's network,
 *     after the "enable physical-device control" check-in (D-0025).
 *
 * Risk by device type drives the policy engine: reading state is READ_ONLY;
 * lights/media/climate are CONSEQUENTIAL; locks/garage/utilities are
 * HIGH_RISK_PHYSICAL — per-action approval PLUS a hardware interlock (R-AUTO-01).
 */

export type DeviceProvenance = "REAL" | "SIMULATION";

export type DeviceType =
  | "light"
  | "thermostat"
  | "blind"
  | "media"
  | "lock"
  | "garage"
  | "utility";

/** Physical risk tier per device type. */
export const DEVICE_RISK: Record<DeviceType, "CONSEQUENTIAL" | "HIGH_RISK_PHYSICAL"> = {
  light: "CONSEQUENTIAL",
  thermostat: "CONSEQUENTIAL",
  blind: "CONSEQUENTIAL",
  media: "CONSEQUENTIAL",
  lock: "HIGH_RISK_PHYSICAL",
  garage: "HIGH_RISK_PHYSICAL",
  utility: "HIGH_RISK_PHYSICAL",
};

export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  room: string;
  /** commands this device accepts, e.g. {on:boolean, brightness:0-100} */
  capabilities: string[];
}

export interface DeviceState {
  id: string;
  provenance: DeviceProvenance;
  /** current attribute values, e.g. {on:true, brightness:60} */
  attributes: Record<string, string | number | boolean>;
  updatedAt: string;
}

export interface DeviceCommand {
  deviceId: string;
  /** attributes to set, e.g. {on:true} or {locked:false} */
  set: Record<string, string | number | boolean>;
}

export interface DeviceResult {
  ok: boolean;
  provenance: DeviceProvenance;
  summary: string;
  /** the observed state AFTER the command — used for independent verification */
  observed?: DeviceState;
}

export interface DeviceGateway {
  readonly provenance: DeviceProvenance;

  listDevices(): Promise<DeviceInfo[]>;
  getState(deviceId: string): Promise<DeviceState | null>;
  /** apply a command; the adapter reads back state so the caller can verify */
  apply(command: DeviceCommand): Promise<DeviceResult>;
}
