import type {
  DeviceCommand,
  DeviceGateway,
  DeviceInfo,
  DeviceResult,
  DeviceState,
} from "./contract.js";

/**
 * Stark-residence SIMULATION device gateway (R-CLASS-02). A real, mutable
 * virtual home so the full device pipeline — discovery, command, policy gating,
 * interlocks, audit, verification — is exercised end-to-end in the container.
 * Provenance is permanently "SIMULATION"; nothing here touches a real device,
 * and results are structurally labeled so the UI never confuses simulated home
 * state with a real home.
 *
 * Verification observes the same mutated model the real Home Assistant adapter
 * would observe via HA state — a light that was told to turn on reads back on.
 */
export class StarkResidence implements DeviceGateway {
  readonly provenance = "SIMULATION" as const;

  private devices: DeviceInfo[] = [
    { id: "light.workshop", name: "Workshop lights", type: "light", room: "workshop", capabilities: ["on", "brightness"] },
    { id: "light.living", name: "Living room lights", type: "light", room: "living", capabilities: ["on", "brightness"] },
    { id: "thermostat.main", name: "Main thermostat", type: "thermostat", room: "hall", capabilities: ["targetC"] },
    { id: "blind.workshop", name: "Workshop blinds", type: "blind", room: "workshop", capabilities: ["position"] },
    { id: "media.workshop", name: "Workshop speakers", type: "media", room: "workshop", capabilities: ["playing", "volume"] },
    { id: "lock.front", name: "Front door", type: "lock", room: "entry", capabilities: ["locked"] },
    { id: "garage.main", name: "Garage door", type: "garage", room: "garage", capabilities: ["open"] },
    { id: "utility.water", name: "Main water valve", type: "utility", room: "basement", capabilities: ["open"] },
  ];

  private state = new Map<string, Record<string, string | number | boolean>>([
    ["light.workshop", { on: false, brightness: 0 }],
    ["light.living", { on: false, brightness: 0 }],
    ["thermostat.main", { targetC: 21 }],
    ["blind.workshop", { position: 100 }],
    ["media.workshop", { playing: false, volume: 30 }],
    ["lock.front", { locked: true }],
    ["garage.main", { open: false }],
    ["utility.water", { open: true }],
  ]);

  private tick = 0;

  async listDevices(): Promise<DeviceInfo[]> {
    return [...this.devices];
  }

  async getState(deviceId: string): Promise<DeviceState | null> {
    const attrs = this.state.get(deviceId);
    if (!attrs) return null;
    return { id: deviceId, provenance: "SIMULATION", attributes: { ...attrs }, updatedAt: this.now() };
  }

  async apply(command: DeviceCommand): Promise<DeviceResult> {
    const device = this.devices.find((d) => d.id === command.deviceId);
    const attrs = this.state.get(command.deviceId);
    if (!device || !attrs) {
      return { ok: false, provenance: "SIMULATION", summary: `no device '${command.deviceId}'` };
    }
    // validate the requested attributes are supported capabilities
    for (const key of Object.keys(command.set)) {
      if (!device.capabilities.includes(key)) {
        return { ok: false, provenance: "SIMULATION", summary: `${device.name} has no capability '${key}'` };
      }
    }
    Object.assign(attrs, command.set);
    const observed = await this.getState(command.deviceId);
    return {
      ok: true,
      provenance: "SIMULATION",
      summary: `${device.name}: ${Object.entries(command.set).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      ...(observed ? { observed } : {}),
    };
  }

  private now(): string {
    return `sim-t${this.tick++}`;
  }
}
