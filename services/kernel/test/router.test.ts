import { describe, expect, it, vi, beforeEach } from "vitest";
import type pg from "pg";
import { GatewayRouter } from "../src/gateway/router.js";
import { ProviderError } from "../src/gateway/provider.js";
import type { ChatRequest, GatewayConfig } from "../src/gateway/schema.js";

/**
 * Router policy tests with stub adapters (test doubles for POLICY logic only —
 * real provider I/O is covered by adapter integration tests + Mac acceptance).
 */

const baseConfig: GatewayConfig = {
  providers: {
    localA: { kind: "ollama", baseUrl: "http://127.0.0.1:1", local: true },
    remoteB: { kind: "anthropic", apiKeyEnv: "TEST_KEY_UNSET", local: false },
  },
  roles: {
    fast_conversation: [
      { provider: "localA", model: "local-model" },
      { provider: "remoteB", model: "remote-model" },
    ],
    deep_reasoning: [{ provider: "remoteB", model: "remote-model" }],
    embeddings: [{ provider: "localA", model: "embed-model" }],
    local_fallback: [{ provider: "localA", model: "local-model" }],
    coding: [{ provider: "localA", model: "m" }],
    vision: [{ provider: "localA", model: "m" }],
    stt: [{ provider: "localA", model: "m" }],
    tts: [{ provider: "localA", model: "m" }],
    reranking: [{ provider: "localA", model: "m" }],
    planning: [{ provider: "localA", model: "m" }],
    verification: [{ provider: "localA", model: "m" }],
    safety_review: [{ provider: "localA", model: "m" }],
    tool_selection: [{ provider: "localA", model: "m" }],
    agent_routing: [{ provider: "localA", model: "m" }],
    long_context: [{ provider: "localA", model: "m" }],
  },
};

const auditRows: unknown[][] = [];
const fakePool = {
  query: vi.fn(async (_sql: string, params?: unknown[]) => {
    if (params) auditRows.push(params);
    return { rows: [] };
  }),
} as unknown as pg.Pool;

function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    role: "fast_conversation",
    messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    privacyClass: "LOCAL_ONLY",
    source: "test",
    ...overrides,
  };
}

// Access the private adapters map to install stubs (test-only).
function stubAdapters(
  router: GatewayRouter,
  impls: Record<string, (...args: never[]) => AsyncGenerator<never> | AsyncGenerator<unknown>>,
) {
  const map = (router as unknown as { adapters: Map<string, unknown> }).adapters;
  for (const [id, chatStream] of Object.entries(impls)) {
    const existing = map.get(id) as Record<string, unknown>;
    map.set(id, { ...existing, chatStream });
  }
}

async function* okStream() {
  yield { type: "text_delta", text: "hi " };
  yield { type: "text_delta", text: "there" };
  yield { type: "done", finishReason: "stop", usage: { inputTokens: 3, outputTokens: 2 } };
}

beforeEach(() => {
  auditRows.length = 0;
  vi.clearAllMocks();
});

describe("GatewayRouter policy", () => {
  it("routes LOCAL_ONLY to the local provider and streams", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, false);
    stubAdapters(router, { localA: okStream });
    const result = await router.chat(req());
    expect(result.provider).toBe("localA");
    expect(result.text).toBe("hi there");
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 2 });
  });

  it("refuses LOCAL_ONLY on a role with only remote targets", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, false);
    await expect(router.chat(req({ role: "deep_reasoning" }))).rejects.toThrow(
      /privacy class LOCAL_ONLY/,
    );
    // refusal itself is audited
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]![5]).toBe(false); // ok=false
  });

  it("offline mode refuses remote providers entirely", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, true);
    await expect(
      router.chat(req({ role: "deep_reasoning", privacyClass: "STANDARD" })),
    ).rejects.toThrow(/offline mode/);
  });

  it("offline mode still serves local roles", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, true);
    stubAdapters(router, { localA: okStream });
    const result = await router.chat(req({ privacyClass: "STANDARD" }));
    expect(result.provider).toBe("localA");
  });

  it("falls back to next target on retryable pre-stream failure (STANDARD)", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, false);
    stubAdapters(router, {
      // eslint-disable-next-line require-yield
      localA: async function* () {
        throw new ProviderError("connection refused", "localA", true);
      },
      remoteB: okStream,
    });
    const result = await router.chat(req({ privacyClass: "STANDARD" }));
    expect(result.provider).toBe("remoteB");
    expect(result.fallbackFrom).toEqual(["localA/local-model"]);
    // two audit rows: failed local attempt + successful remote
    expect(auditRows.length).toBe(2);
  });

  it("does NOT fall back after content has streamed (no silent model switch)", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, false);
    stubAdapters(router, {
      localA: async function* () {
        yield { type: "text_delta", text: "partial" };
        throw new ProviderError("mid-stream drop", "localA", true);
      },
      remoteB: okStream,
    });
    await expect(router.chat(req({ privacyClass: "STANDARD" }))).rejects.toThrow(/mid-stream/);
  });

  it("validates structured output against responseSchema", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, false);
    stubAdapters(router, {
      localA: async function* () {
        yield { type: "text_delta", text: '{"answer": 42}' };
        yield { type: "done", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    });
    const good = await router.chat(
      req({
        responseSchema: {
          type: "object",
          properties: { answer: { type: "number" } },
          required: ["answer"],
        },
      }),
    );
    expect(good.text).toBe('{"answer": 42}');

    stubAdapters(router, {
      localA: async function* () {
        yield { type: "text_delta", text: "not json at all" };
        yield { type: "done", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    });
    await expect(
      router.chat(req({ responseSchema: { type: "object" } })),
    ).rejects.toThrow(/structured output/);
  });

  it("forwards per-target effort/thinking to the adapter and shows them in the role table", async () => {
    const config: GatewayConfig = {
      ...baseConfig,
      roles: {
        ...baseConfig.roles,
        deep_reasoning: [
          { provider: "remoteB", model: "remote-model", effort: "xhigh", thinking: "adaptive" },
        ],
      },
    };
    const router = new GatewayRouter(config, fakePool, false);
    let seen: unknown;
    stubAdapters(router, {
      remoteB: async function* (_r: unknown, _m: unknown, _s: unknown, opts: unknown) {
        seen = opts;
        yield { type: "done", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    });
    await router.chat(req({ role: "deep_reasoning", privacyClass: "STANDARD" }));
    expect(seen).toEqual({ effort: "xhigh", thinking: "adaptive" });
    expect(router.roleTable().deep_reasoning).toEqual(["remoteB/remote-model@xhigh+thinking"]);
  });

  it("audits successful calls with role/provider/tokens/privacy class", async () => {
    const router = new GatewayRouter(baseConfig, fakePool, false);
    stubAdapters(router, { localA: okStream });
    await router.chat(req());
    expect(auditRows.length).toBe(1);
    const row = auditRows[0]!;
    expect(row[0]).toBe("fast_conversation");
    expect(row[1]).toBe("localA");
    expect(row[3]).toBe("LOCAL_ONLY");
    expect(row[5]).toBe(true); // ok
    expect(row[7]).toBe(3); // input tokens
    expect(row[8]).toBe(2); // output tokens
  });
});
