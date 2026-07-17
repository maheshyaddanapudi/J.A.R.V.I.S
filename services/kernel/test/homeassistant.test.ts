import { describe, expect, it, vi, afterEach } from "vitest";
import { HomeAssistantGateway, homeAssistantFromVault } from "../src/devices/homeassistant.js";

/**
 * REAL Home Assistant adapter, exercised against a mocked HA REST API (no live
 * HA in the container). Proves: HA entities map to our typed devices, commands
 * hit the right service, and the token is resolved from the SecretsVault and
 * carried as a Bearer header — never in code/config (R-MEM-06/D-0028).
 */

const realFetch = globalThis.fetch;
let captured: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];

function mockHA(handler: (url: string) => { status?: number; json?: unknown }) {
  captured = [];
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    captured.push({
      url: u,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      ...(init?.body ? { body: String(init.body) } : {}),
    });
    const { status = 200, json = {} } = handler(u);
    return { ok: status < 400, status, json: async () => json } as unknown as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("HomeAssistantGateway (REAL adapter, mocked HA)", () => {
  it("resolves the token from the vault and carries it as a Bearer header", async () => {
    mockHA(() => ({ json: [] }));
    const secrets = { get: vi.fn(async (n: string) => (n === "home_assistant_token" ? "llat-SECRET" : undefined)) };
    const ha = homeAssistantFromVault("http://homeassistant.local:8123", secrets);
    await ha.listDevices();
    expect(secrets.get).toHaveBeenCalledWith("home_assistant_token");
    expect(captured[0]!.headers["authorization"]).toBe("Bearer llat-SECRET");
    expect(captured[0]!.url).toBe("http://homeassistant.local:8123/api/states");
  });

  it("maps HA entities to typed devices (and skips unknown domains)", async () => {
    mockHA(() => ({
      json: [
        { entity_id: "light.kitchen", attributes: { friendly_name: "Kitchen", area: "Kitchen" } },
        { entity_id: "lock.front_door", attributes: { friendly_name: "Front Door" } },
        { entity_id: "sensor.temperature", attributes: { friendly_name: "Temp" } }, // unknown → skipped
      ],
    }));
    const ha = new HomeAssistantGateway("http://ha:8123", async () => "t");
    const devices = await ha.listDevices();
    expect(devices.map((d) => `${d.id}:${d.type}`).sort()).toEqual([
      "light.kitchen:light",
      "lock.front_door:lock",
    ]);
    expect(devices.find((d) => d.id === "light.kitchen")!.room).toBe("Kitchen");
  });

  it("apply(unlock) posts the lock.unlock service with the token, then reads state back", async () => {
    mockHA((url) =>
      url.endsWith("/api/states/lock.front_door")
        ? { json: { state: "unlocked", attributes: {}, last_updated: "2026-07-17T00:00:00Z" } }
        : { json: {} },
    );
    const ha = new HomeAssistantGateway("http://ha:8123", async () => "tok-123");
    const res = await ha.apply({ deviceId: "lock.front_door", set: { locked: false } });
    expect(res.ok).toBe(true);
    const post = captured.find((c) => c.method === "POST")!;
    expect(post.url).toBe("http://ha:8123/api/services/lock/unlock");
    expect(post.headers["authorization"]).toBe("Bearer tok-123");
    expect(res.observed?.attributes.state).toBe("unlocked");
  });

  it("fails closed when the HA token secret is not set", async () => {
    mockHA(() => ({ json: [] }));
    const secrets = { get: vi.fn(async () => undefined) };
    const ha = homeAssistantFromVault("http://ha:8123", secrets);
    await expect(ha.listDevices()).rejects.toThrow(/token secret .* is not set/);
    expect(captured.length).toBe(0); // never reached the network
  });
});
