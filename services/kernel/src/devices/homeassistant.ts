import type {
  DeviceCommand,
  DeviceGateway,
  DeviceInfo,
  DeviceResult,
  DeviceState,
  DeviceType,
} from "./contract.js";

/**
 * REAL Home Assistant device gateway (Apache-2.0 HA, RESEARCH_VERIFICATION §8).
 *
 * Reaches real devices over the user's LAN via the HA REST API. Local-only: the
 * base URL is a LAN address the user configures; the token is a long-lived HA
 * access token held in the vault, never in code (R-MEM-06). Provenance "REAL".
 *
 * GATE: this is the real backend. Binding it into the kernel requires the
 * "before enabling physical-device control" check-in (D-0025). Until then the
 * kernel uses the SIMULATION gateway; this compiles and is exercised against a
 * real HA only after that check-in, on the user's Mac/network.
 *
 * Mapping: HA entities → our typed devices. HA domain (light., lock., cover.,
 * media_player., climate.) maps to our DeviceType; services (turn_on/lock/…) are
 * derived from the requested attributes.
 */
export class HomeAssistantGateway implements DeviceGateway {
  readonly provenance = "REAL" as const;

  constructor(
    private readonly baseUrl: string, // e.g. http://homeassistant.local:8123
    private readonly token: () => Promise<string>, // resolved from the vault at call time
  ) {}

  private async headers(): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/states`, { headers: await this.headers() });
    if (!res.ok) throw new Error(`HA /api/states HTTP ${res.status}`);
    const states = (await res.json()) as { entity_id: string; attributes: Record<string, unknown> }[];
    const out: DeviceInfo[] = [];
    for (const s of states) {
      const type = domainToType(s.entity_id.split(".")[0] ?? "");
      if (!type) continue;
      out.push({
        id: s.entity_id,
        name: String(s.attributes.friendly_name ?? s.entity_id),
        type,
        room: String(s.attributes.area ?? "unknown"),
        capabilities: capabilitiesFor(type),
      });
    }
    return out;
  }

  async getState(deviceId: string): Promise<DeviceState | null> {
    const res = await fetch(`${this.baseUrl}/api/states/${deviceId}`, { headers: await this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HA state HTTP ${res.status}`);
    const s = (await res.json()) as { state: string; attributes: Record<string, unknown>; last_updated: string };
    return {
      id: deviceId,
      provenance: "REAL",
      attributes: { state: s.state, ...(s.attributes as Record<string, string | number | boolean>) },
      updatedAt: s.last_updated,
    };
  }

  async apply(command: DeviceCommand): Promise<DeviceResult> {
    const [domain] = command.deviceId.split(".");
    const { service, data } = toService(domain ?? "", command.set);
    const res = await fetch(`${this.baseUrl}/api/services/${domain}/${service}`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify({ entity_id: command.deviceId, ...data }),
    });
    if (!res.ok) {
      return { ok: false, provenance: "REAL", summary: `HA ${domain}.${service} HTTP ${res.status}` };
    }
    const observed = await this.getState(command.deviceId);
    return {
      ok: true,
      provenance: "REAL",
      summary: `${command.deviceId}: ${domain}.${service}`,
      ...(observed ? { observed } : {}),
    };
  }
}

/**
 * Build a Home Assistant gateway whose token is drawn from the managed
 * SecretsVault by name (R-MEM-06/D-0028) — the token never lives in code or
 * config. Fails closed at call time if the secret is not set. This is the
 * constructor used at the D-0025 check-in on the Mac.
 */
export function homeAssistantFromVault(
  baseUrl: string,
  secrets: { get(name: string): Promise<string | undefined> },
  secretName = "home_assistant_token",
): HomeAssistantGateway {
  return new HomeAssistantGateway(baseUrl, async () => {
    const token = await secrets.get(secretName);
    if (!token) throw new Error(`Home Assistant token secret '${secretName}' is not set`);
    return token;
  });
}

function domainToType(domain: string): DeviceType | null {
  const map: Record<string, DeviceType> = {
    light: "light",
    lock: "lock",
    cover: "blind",
    media_player: "media",
    climate: "thermostat",
    switch: "utility",
  };
  return map[domain] ?? null;
}

function capabilitiesFor(type: DeviceType): string[] {
  return {
    light: ["on", "brightness"],
    thermostat: ["targetC"],
    blind: ["position"],
    media: ["playing", "volume"],
    lock: ["locked"],
    garage: ["open"],
    utility: ["open"],
  }[type];
}

/** Map requested attributes to an HA service + data. */
function toService(
  domain: string,
  set: Record<string, string | number | boolean>,
): { service: string; data: Record<string, unknown> } {
  if (domain === "light") {
    if (set.on === false) return { service: "turn_off", data: {} };
    const data: Record<string, unknown> = {};
    if (typeof set.brightness === "number") data.brightness_pct = set.brightness;
    return { service: "turn_on", data };
  }
  if (domain === "lock") return { service: set.locked === false ? "unlock" : "lock", data: {} };
  if (domain === "cover") return { service: "set_cover_position", data: { position: set.position } };
  if (domain === "climate") return { service: "set_temperature", data: { temperature: set.targetC } };
  if (domain === "media_player")
    return set.playing === false
      ? { service: "media_pause", data: {} }
      : { service: "media_play", data: {} };
  if (domain === "switch") return { service: set.open ? "turn_on" : "turn_off", data: {} };
  return { service: "turn_on", data: set };
}
