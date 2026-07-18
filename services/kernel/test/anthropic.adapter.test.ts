import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnthropicAdapter } from "../src/gateway/providers/anthropic.js";
import type { ChatEvent, ChatRequest } from "../src/gateway/schema.js";

/**
 * Wire-format tests for the Anthropic adapter (no network — fetch is stubbed).
 * They pin the CURRENT Messages API shape (verified against Anthropic docs
 * 2026-07-18):
 *  - extended thinking is `thinking: {type:"adaptive"}` + `output_config.effort`
 *    on Sonnet 5-era models; the old `budget_tokens` shape is HTTP-400 there
 *    and must NEVER be sent;
 *  - sampling params (temperature) are rejected on those models → dropped;
 *  - tool-bearing requests explicitly DISABLE thinking (omitting the field
 *    defaults it ON there, and our neutral schema cannot replay thinking
 *    blocks, which Anthropic requires intact on tool-use turns).
 */

const SSE =
  [
    'data: {"type":"message_start","message":{"usage":{"input_tokens":5}}}',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":""}}',
    'data: {"type":"content_block_stop","index":0}',
    'data: {"type":"content_block_start","index":1,"content_block":{"type":"text"}}',
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Good evening."}}',
    'data: {"type":"content_block_stop","index":1}',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7}}',
    'data: {"type":"message_stop"}',
  ].join("\n\n") + "\n\n";

let bodies: Record<string, unknown>[] = [];

beforeEach(() => {
  bodies = [];
  process.env.TEST_ANTHROPIC_KEY = "test-key-not-real";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(SSE, { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TEST_ANTHROPIC_KEY;
});

const adapter = () => createAnthropicAdapter({ id: "anthropic", apiKeyEnv: "TEST_ANTHROPIC_KEY" });

function req(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    role: "deep_reasoning",
    messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    privacyClass: "STANDARD",
    source: "test",
    ...overrides,
  };
}

const TOOL = { name: "t", description: "d", inputSchema: { type: "object" } };

async function drain(gen: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("anthropic adapter wire format", () => {
  it("sends adaptive thinking + output_config.effort on sonnet-5, never budget_tokens", async () => {
    await drain(
      adapter().chatStream(req({ temperature: 0.7 }), "claude-sonnet-5", undefined, {
        effort: "xhigh",
        thinking: "on",
      }),
    );
    const body = bodies[0]!;
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "xhigh" });
    expect(JSON.stringify(body)).not.toContain("budget_tokens");
    // sampling params are rejected on this generation — the hint is dropped
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_tokens).toBe(16000);
  });

  it("explicitly disables thinking when tools are present (sonnet-5)", async () => {
    await drain(
      adapter().chatStream(req({ tools: [TOOL] }), "claude-sonnet-5", undefined, {
        thinking: "on",
      }),
    );
    expect(bodies[0]!.thinking).toEqual({ type: "disabled" });
  });

  it("omits thinking entirely with tools on always-thinking models (fable-5)", async () => {
    await drain(adapter().chatStream(req({ tools: [TOOL] }), "claude-fable-5"));
    expect(bodies[0]).not.toHaveProperty("thinking");
  });

  it("keeps temperature and ignores adaptive hints on pre-adaptive models (haiku)", async () => {
    await drain(
      adapter().chatStream(req({ temperature: 0.4 }), "claude-haiku-4-5-20251001", undefined, {
        effort: "xhigh",
        thinking: "on",
      }),
    );
    const body = bodies[0]!;
    expect(body.temperature).toBe(0.4);
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("output_config");
    expect(body.max_tokens).toBe(4096);
  });

  it("streams text through thinking blocks without corruption", async () => {
    const events = await drain(adapter().chatStream(req(), "claude-sonnet-5"));
    const text = events
      .filter((e): e is Extract<ChatEvent, { type: "text_delta" }> => e.type === "text_delta")
      .map((e) => e.text)
      .join("");
    expect(text).toBe("Good evening.");
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
    const done = events.find((e): e is Extract<ChatEvent, { type: "done" }> => e.type === "done")!;
    expect(done.finishReason).toBe("stop");
    expect(done.usage).toEqual({ inputTokens: 5, outputTokens: 7 });
  });
});
