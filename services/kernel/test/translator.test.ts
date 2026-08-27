import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAiCompatAdapter } from "../src/gateway/providers/openaiCompat.js";
import { createOllamaAdapter } from "../src/gateway/providers/ollama.js";
import { DEFAULT_GATEWAY_CONFIG, resolveGatewayConfig } from "../src/gateway/config.js";
import type { ChatEvent, ChatRequest, GatewayConfig } from "../src/gateway/schema.js";

/**
 * Provider-agnostic generation settings (D-0049): ONE neutral vocabulary
 * ({effort, thinking}) is translated per provider by the adapters, and common
 * env vars (JARVIS_EFFORT / JARVIS_THINKING / JARVIS_ROLE_<ROLE>) resolve at
 * config load so the outcome is visible in /gateway/roles. Wire dialects
 * verified against provider docs 2026-07-18.
 */

const OPENAI_SSE =
  [
    'data: {"choices":[{"index":0,"delta":{"content":"Hello."}}]}',
    'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3}}',
    "data: [DONE]",
  ].join("\n") + "\n";

const OLLAMA_NDJSON =
  [
    '{"message":{"thinking":"quietly reasoning"}}',
    '{"message":{"content":"Hello."}}',
    '{"done":true,"prompt_eval_count":2,"eval_count":3}',
  ].join("\n") + "\n";

let bodies: Record<string, unknown>[] = [];

function stubFetch(payload: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(payload, { status: 200 });
    }),
  );
}

beforeEach(() => {
  bodies = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    role: "deep_reasoning",
    messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    privacyClass: "STANDARD",
    source: "test",
    ...overrides,
  };
}

async function drain(gen: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("openai_compat translation (OpenAI / OpenRouter / Grok / vLLM dialect)", () => {
  const adapter = () => createOpenAiCompatAdapter({ id: "oa", local: false });

  it("passes the neutral effort ladder through verbatim as reasoning_effort and drops temperature", async () => {
    stubFetch(OPENAI_SSE);
    await drain(adapter().chatStream(req({ temperature: 0.7 }), "gpt-5.2", undefined, { effort: "xhigh" }));
    expect(bodies[0]!.reasoning_effort).toBe("xhigh");
    expect(bodies[0]).not.toHaveProperty("temperature");
  });

  it('thinking "on" without effort applies the classic default ("medium")', async () => {
    stubFetch(OPENAI_SSE);
    await drain(adapter().chatStream(req(), "gpt-5.2", undefined, { thinking: "on" }));
    expect(bodies[0]!.reasoning_effort).toBe("medium");
  });

  it('thinking "off" suppresses the reasoning knob even with an effort set', async () => {
    stubFetch(OPENAI_SSE);
    await drain(
      adapter().chatStream(req({ temperature: 0.4 }), "gpt-4.1", undefined, {
        effort: "high",
        thinking: "off",
      }),
    );
    expect(bodies[0]).not.toHaveProperty("reasoning_effort");
    expect(bodies[0]!.temperature).toBe(0.4);
  });

  it("targets with neither field get the exact pre-translation body (local llama.cpp/vLLM unaffected)", async () => {
    stubFetch(OPENAI_SSE);
    await drain(adapter().chatStream(req({ temperature: 0.2 }), "llama-3.3-70b"));
    expect(bodies[0]).not.toHaveProperty("reasoning_effort");
    expect(bodies[0]!.temperature).toBe(0.2);
  });
});

describe("ollama translation (think booleans/levels; gpt-oss level ceiling)", () => {
  const adapter = () => createOllamaAdapter({ id: "ol", local: true });

  it('thinking "on" + effort maps to a think level with a "high" ceiling (gpt-oss)', async () => {
    stubFetch(OLLAMA_NDJSON);
    await drain(adapter().chatStream(req(), "gpt-oss:120b", undefined, { thinking: "on", effort: "xhigh" }));
    expect(bodies[0]!.think).toBe("high");
    stubFetch(OLLAMA_NDJSON);
    await drain(adapter().chatStream(req(), "gpt-oss:120b", undefined, { thinking: "on", effort: "low" }));
    expect(bodies[1]!.think).toBe("low");
  });

  it('thinking "on" without effort sends think:true; "off" sends think:false; unset omits', async () => {
    stubFetch(OLLAMA_NDJSON);
    await drain(adapter().chatStream(req(), "qwen3.6:35b-a3b", undefined, { thinking: "on" }));
    await drain(adapter().chatStream(req(), "qwen3.6:35b-a3b", undefined, { thinking: "off" }));
    await drain(adapter().chatStream(req(), "qwen3.6:35b-a3b"));
    expect(bodies[0]!.think).toBe(true);
    expect(bodies[1]!.think).toBe(false);
    expect(bodies[2]).not.toHaveProperty("think");
  });

  it("the message.thinking trace never leaks into answer text", async () => {
    stubFetch(OLLAMA_NDJSON);
    const events = await drain(
      adapter().chatStream(req(), "gpt-oss:120b", undefined, { thinking: "on" }),
    );
    const text = events
      .filter((e): e is Extract<ChatEvent, { type: "text_delta" }> => e.type === "text_delta")
      .map((e) => e.text)
      .join("");
    expect(text).toBe("Hello.");
    expect(text).not.toContain("quietly reasoning");
  });
});

describe("resolveGatewayConfig — common env controls + normalization", () => {
  const base: GatewayConfig = {
    providers: {
      ollama: { kind: "ollama", local: true },
      anthropic: { kind: "anthropic", local: false },
      openai: { kind: "openai_compat", local: false },
    },
    roles: {
      fast_conversation: [
        { provider: "ollama", model: "qwen3.6:35b-a3b" },
        { provider: "anthropic", model: "claude-sonnet-5" },
      ],
      deep_reasoning: [{ provider: "openai", model: "gpt-5.2", effort: "low" }],
      embeddings: [{ provider: "openai", model: "text-embedding-3-large" }],
      local_fallback: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    },
  };

  it('normalizes the legacy "adaptive" alias to neutral "on"', () => {
    const cfg = resolveGatewayConfig(
      {
        ...base,
        roles: { ...base.roles, deep_reasoning: [{ provider: "anthropic", model: "m", thinking: "adaptive" }] },
      },
      {},
    );
    expect(cfg.roles.deep_reasoning![0]!.thinking).toBe("on");
  });

  it("JARVIS_EFFORT/JARVIS_THINKING default remote reasoning targets, never ollama, never explicit values", () => {
    const cfg = resolveGatewayConfig(base, { JARVIS_EFFORT: "xhigh", JARVIS_THINKING: "on" });
    const [local, remote] = cfg.roles.fast_conversation!;
    expect(local).not.toHaveProperty("effort"); // ollama: per-target opt-in only
    expect(local).not.toHaveProperty("thinking");
    expect(remote!.effort).toBe("xhigh");
    expect(remote!.thinking).toBe("on");
    expect(cfg.roles.deep_reasoning![0]!.effort).toBe("low"); // explicit wins over env
    // non-generative roles never get reasoning knobs (would mislead in /models)
    expect(cfg.roles.embeddings![0]).not.toHaveProperty("effort");
    expect(cfg.roles.embeddings![0]).not.toHaveProperty("thinking");
  });

  it("JARVIS_ROLE_<ROLE> pins a role, parsing model names with ':' plus @effort and +thinking", () => {
    const cfg = resolveGatewayConfig(base, {
      JARVIS_ROLE_DEEP_REASONING: "ollama/gpt-oss:120b@high+thinking",
    });
    expect(cfg.roles.deep_reasoning).toEqual([
      { provider: "ollama", model: "gpt-oss:120b", effort: "high", thinking: "on" },
    ]);
  });

  it("rejects invalid env values loudly", () => {
    expect(() => resolveGatewayConfig(base, { JARVIS_EFFORT: "turbo" })).toThrow(/JARVIS_EFFORT/);
    expect(() => resolveGatewayConfig(base, { JARVIS_ROLE_CODING: "nosuch/model" })).toThrow(/unknown provider/);
    expect(() => resolveGatewayConfig(base, { JARVIS_ROLE_CODING: "garbage" })).toThrow(/expected provider\/model/);
  });

  it("the shipped default config resolves cleanly with no env", () => {
    const cfg = resolveGatewayConfig(DEFAULT_GATEWAY_CONFIG, {});
    expect(cfg.roles.deep_reasoning![0]).toMatchObject({ provider: "ollama", thinking: "on" });
  });
});
