import { describe, expect, it, vi, afterEach } from "vitest";
import { createAnthropicAdapter } from "../src/gateway/providers/anthropic.js";
import { createOpenAiCompatAdapter } from "../src/gateway/providers/openaiCompat.js";

/**
 * Adapters resolve API keys from the managed SecretsVault first, then fall back
 * to env (R-MEM-06/D-0028). We drive this through ping(), which makes a single
 * authenticated fetch — capture its headers and assert which key was used.
 */

const realFetch = globalThis.fetch;
let captured: { url: string; headers: Record<string, string> }[] = [];

function mockFetch() {
  captured = [];
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return { ok: true, status: 200 } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.TEST_ANTHROPIC_KEY;
  delete process.env.TEST_OAI_KEY;
});

describe("gateway adapters resolve keys from the SecretsVault (R-MEM-06)", () => {
  it("anthropic: uses the vault secret when present", async () => {
    mockFetch();
    const adapter = createAnthropicAdapter({
      id: "anthropic",
      apiKeySecret: "anthropic_api_key",
      apiKeyEnv: "TEST_ANTHROPIC_KEY",
      resolveSecret: async (name) => (name === "anthropic_api_key" ? "vault-key-AAA" : undefined),
    });
    const res = await adapter.ping();
    expect(res.ok).toBe(true);
    expect(captured[0]!.headers["x-api-key"]).toBe("vault-key-AAA");
  });

  it("anthropic: vault wins over env when both are set", async () => {
    mockFetch();
    process.env.TEST_ANTHROPIC_KEY = "env-key-BBB";
    const adapter = createAnthropicAdapter({
      id: "anthropic",
      apiKeySecret: "anthropic_api_key",
      apiKeyEnv: "TEST_ANTHROPIC_KEY",
      resolveSecret: async () => "vault-key-AAA",
    });
    await adapter.ping();
    expect(captured[0]!.headers["x-api-key"]).toBe("vault-key-AAA");
  });

  it("anthropic: falls back to env when the vault has no such secret", async () => {
    mockFetch();
    process.env.TEST_ANTHROPIC_KEY = "env-key-BBB";
    const adapter = createAnthropicAdapter({
      id: "anthropic",
      apiKeySecret: "anthropic_api_key",
      apiKeyEnv: "TEST_ANTHROPIC_KEY",
      resolveSecret: async () => undefined,
    });
    await adapter.ping();
    expect(captured[0]!.headers["x-api-key"]).toBe("env-key-BBB");
  });

  it("anthropic: reports not-configured when neither vault nor env has a key", async () => {
    mockFetch();
    const adapter = createAnthropicAdapter({
      id: "anthropic",
      apiKeySecret: "anthropic_api_key",
      apiKeyEnv: "TEST_ANTHROPIC_KEY",
      resolveSecret: async () => undefined,
    });
    const res = await adapter.ping();
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/no key/);
    expect(captured.length).toBe(0); // never even attempted the request
  });

  it("openai_compat: uses the vault secret in the Authorization header", async () => {
    mockFetch();
    const adapter = createOpenAiCompatAdapter({
      id: "oai",
      local: false,
      apiKeySecret: "openai_api_key",
      apiKeyEnv: "TEST_OAI_KEY",
      resolveSecret: async (name) => (name === "openai_api_key" ? "vault-oai-CCC" : undefined),
    });
    await adapter.ping();
    expect(captured[0]!.headers["authorization"]).toBe("Bearer vault-oai-CCC");
  });

  it("openai_compat: local provider with no key sends no auth header", async () => {
    mockFetch();
    const adapter = createOpenAiCompatAdapter({ id: "llama", local: true });
    await adapter.ping();
    expect(captured[0]!.headers["authorization"]).toBeUndefined();
  });
});
