import { describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { GatewayRouter, pinOf } from "../src/gateway/router.js";
import { loadRoleOverrides, persistRoleOverrides, ROLE_OVERRIDES_KEY } from "../src/gateway/overrides.js";
import type { GatewayConfig } from "../src/gateway/schema.js";

/**
 * Runtime role overrides (D-0054): re-route a role among ALREADY CONFIGURED
 * providers without a restart — user-sourced, ledgered, persisted, and unable
 * to widen the egress surface or bypass privacy/offline gating.
 */

const config: GatewayConfig = {
  providers: {
    localA: { kind: "ollama", baseUrl: "http://127.0.0.1:1", local: true },
    remoteB: { kind: "anthropic", apiKeyEnv: "UNSET", local: false },
  },
  roles: {
    fast_conversation: [{ provider: "localA", model: "local-model" }],
    deep_reasoning: [{ provider: "localA", model: "big-local" }],
    local_fallback: [{ provider: "localA", model: "local-model" }],
  },
};

const fakePool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as pg.Pool;

function store() {
  const data = new Map<string, string>();
  return {
    data,
    async get(key: string) {
      const v = data.get(key);
      return v === undefined ? null : { value: v };
    },
    async remember(input: { key: string; value: string; provenance: string }) {
      data.set(input.key, input.value);
      return {};
    },
  };
}

describe("gateway runtime role overrides (D-0054)", () => {
  it("re-routes a role live, shows the override + ledger, and clears back to config", () => {
    const router = new GatewayRouter(config, fakePool, false);
    router.overrideRole(
      "deep_reasoning",
      [{ provider: "remoteB", model: "claude-sonnet-5", effort: "xhigh", thinking: "on" }],
      { reason: "key test: point deep at sonnet-5" },
    );
    expect(router.roleTable().deep_reasoning).toEqual(["remoteB/claude-sonnet-5@xhigh+thinking"]);
    expect(router.eligibleTargets("deep_reasoning", "STANDARD")[0]!.provider).toBe("remoteB");
    const o = router.overrides().deep_reasoning!;
    expect(o.reason).toContain("key test");
    expect(o.at).toBeTruthy();
    expect(router.clearRoleOverride("deep_reasoning")).toBe(true);
    expect(router.roleTable().deep_reasoning).toEqual(["localA/big-local"]);
    expect(router.overrides()).toEqual({});
  });

  it("refuses unknown providers — the egress surface cannot widen at runtime", () => {
    const router = new GatewayRouter(config, fakePool, false);
    expect(() =>
      router.overrideRole("coding", [{ provider: "evil-endpoint", model: "x" }], { reason: "r" }),
    ).toThrow(/unknown provider 'evil-endpoint'/);
  });

  it("privacy and offline gating still apply to overridden targets", () => {
    const router = new GatewayRouter(config, fakePool, false);
    router.overrideRole("fast_conversation", [{ provider: "remoteB", model: "m" }], { reason: "r" });
    // LOCAL_ONLY payloads never reach the remote override
    expect(router.eligibleTargets("fast_conversation", "LOCAL_ONLY")).toEqual([]);
    const offlineRouter = new GatewayRouter(config, fakePool, true);
    offlineRouter.overrideRole("fast_conversation", [{ provider: "remoteB", model: "m" }], { reason: "r" });
    expect(offlineRouter.eligibleTargets("fast_conversation", "STANDARD")).toEqual([]);
  });

  it("persists and restores overrides across router rebuilds; stale pins are skipped, not fatal", async () => {
    const s = store();
    const router = new GatewayRouter(config, fakePool, false);
    router.overrideRole(
      "deep_reasoning",
      [{ provider: "remoteB", model: "claude-sonnet-5", effort: "xhigh", thinking: "on" }],
      { reason: "persist me" },
    );
    await persistRoleOverrides(router, s);

    const fresh = new GatewayRouter(config, fakePool, false);
    const r1 = await loadRoleOverrides(fresh, s);
    expect(r1).toEqual({ applied: 1, skipped: [] });
    expect(fresh.roleTable().deep_reasoning).toEqual(["remoteB/claude-sonnet-5@xhigh+thinking"]);
    expect(fresh.overrides().deep_reasoning!.reason).toBe("persist me");

    // a pin referencing a provider that no longer exists is skipped honestly
    s.data.set(
      ROLE_OVERRIDES_KEY,
      JSON.stringify({
        deep_reasoning: { pins: ["gone/model-x"], reason: "stale", at: "2026-07-18T00:00:00Z" },
        coding: { pins: ["localA/qwen3.6:35b-a3b@high"], reason: "ok", at: "2026-07-18T00:00:00Z" },
      }),
    );
    const fresh2 = new GatewayRouter(config, fakePool, false);
    const r2 = await loadRoleOverrides(fresh2, s);
    expect(r2.applied).toBe(1);
    expect(r2.skipped[0]).toContain("deep_reasoning");
    expect(fresh2.roleTable().coding).toEqual(["localA/qwen3.6:35b-a3b@high"]);
  });

  it("pinOf round-trips the canonical syntax", () => {
    expect(pinOf({ provider: "ollama", model: "gpt-oss:120b", effort: "high", thinking: "on" }))
      .toBe("ollama/gpt-oss:120b@high+thinking");
    expect(pinOf({ provider: "a", model: "m", thinking: "off" })).toBe("a/m+nothink");
    expect(pinOf({ provider: "a", model: "m" })).toBe("a/m");
  });
});
