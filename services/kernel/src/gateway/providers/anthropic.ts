import type { ProviderAdapter } from "../provider.js";
import { ProviderError } from "../provider.js";
import type { ChatEvent, ChatRequest, NeutralMessage, TargetOptions } from "../schema.js";

/**
 * Anthropic Messages API adapter (the "one cloud adapter" of slice 1.2).
 * Remote provider: local=false — the router refuses it for LOCAL_ONLY payloads
 * and in offline mode. API key comes from the environment at call time; it is
 * never logged, stored, or echoed (R-MEM-06).
 */

/**
 * Claude generations where (a) extended thinking is ADAPTIVE BY DEFAULT when the
 * `thinking` field is omitted, (b) the old `thinking: {type:"enabled",
 * budget_tokens}` shape and sampling params (temperature/top_p/top_k) are
 * rejected with HTTP 400, and (c) `output_config.effort` is available.
 * Verified against Anthropic docs 2026-07-18.
 */
const ADAPTIVE_GEN = /^claude-(sonnet-5|opus-4-[78]|fable-5|mythos-5)/;
/** Models where thinking is always on — `{type:"disabled"}` is itself rejected. */
const ALWAYS_THINKS = /^claude-(fable-5|mythos-5)/;

/**
 * Neutral→Anthropic thinking translation (D-0049): "on" → adaptive, "off" →
 * disabled. Anthropic requires tool-use turns to be replayed with their
 * thinking blocks INTACT, and our neutral schema does not carry provider
 * thinking blocks — so with tools in play we must explicitly disable thinking
 * on models where it would otherwise default on (else the replayed turn 400s).
 * Thinking is honored only for tool-free requests (converse path).
 */
function thinkingField(
  model: string,
  hasTools: boolean,
  wanted: TargetOptions["thinking"],
): { type: "adaptive" } | { type: "disabled" } | undefined {
  const modern = ADAPTIVE_GEN.test(model);
  const canDisable = modern && !ALWAYS_THINKS.test(model);
  if (hasTools) return canDisable ? { type: "disabled" } : undefined;
  // Pre-adaptive models (e.g. haiku-4-5) only speak the deprecated budget shape;
  // we deliberately don't emit it — the hint is ignored there (off by default).
  if (wanted === "on" && modern) return { type: "adaptive" };
  if (wanted === "off" && canDisable) return { type: "disabled" };
  return undefined;
}

/**
 * Anthropic tool names must match ^[a-zA-Z0-9_-]{1,128}$ (verified against the
 * live API 2026-07-18: dotted names like `system.info` and colon MCP names like
 * `mcp:server:tool` are rejected with HTTP 400). J.A.R.V.I.S. tool names use
 * both. We map each real name to a wire-safe name for the request and restore
 * the real name when Claude calls the tool back — collisions disambiguated so
 * the round-trip is exact. `.`/`:`/anything-else → `_`.
 */
function buildToolNameMap(tools: { name: string }[]): {
  toWire: Map<string, string>;
  toReal: Map<string, string>;
} {
  const toWire = new Map<string, string>();
  const toReal = new Map<string, string>();
  const used = new Set<string>();
  for (const t of tools) {
    let wire = t.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128) || "tool";
    if (used.has(wire)) {
      let i = 1;
      while (used.has(`${wire.slice(0, 124)}_${i}`)) i++;
      wire = `${wire.slice(0, 124)}_${i}`;
    }
    used.add(wire);
    toWire.set(t.name, wire);
    toReal.set(wire, t.name);
  }
  return { toWire, toReal };
}

function toAnthropicPayload(messages: NeutralMessage[], toWire?: Map<string, string>) {
  const wire = (name: string) => toWire?.get(name) ?? name;
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      switch (m.role) {
        case "user":
          return {
            role: "user" as const,
            content: m.content.map((p) =>
              p.type === "text"
                ? { type: "text" as const, text: p.text }
                : {
                    type: "image" as const,
                    source: { type: "base64" as const, media_type: p.mediaType, data: p.data },
                  },
            ),
          };
        case "assistant":
          return {
            role: "assistant" as const,
            content: [
              ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
              ...(m.toolCalls ?? []).map((c) => ({
                type: "tool_use" as const,
                id: c.id,
                name: wire(c.name),
                input: c.arguments,
              })),
            ],
          };
        case "tool":
          return {
            role: "user" as const,
            content: [
              { type: "tool_result" as const, tool_use_id: m.toolCallId, content: m.content },
            ],
          };
        default:
          throw new Error("unreachable");
      }
    });

  return { system: system || undefined, messages: turns };
}

export function createAnthropicAdapter(opts: {
  id: string;
  baseUrl?: string;
  /** name of a secret in the managed SecretsVault (preferred, R-MEM-06) */
  apiKeySecret?: string;
  /** env var fallback when no vault/secret is configured */
  apiKeyEnv?: string;
  /** resolves a named secret from the encrypted vault; undefined = no vault */
  resolveSecret?: (name: string) => Promise<string | undefined>;
}): ProviderAdapter {
  const baseUrl = (opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const apiKeyEnv = opts.apiKeyEnv ?? "ANTHROPIC_API_KEY";

  // Prefer the encrypted secrets vault; fall back to env. The key itself never
  // lives in config or the audit — only its secret-name / env-var-name does.
  async function resolveKey(): Promise<string | undefined> {
    if (opts.apiKeySecret && opts.resolveSecret) {
      const fromVault = await opts.resolveSecret(opts.apiKeySecret);
      if (fromVault) return fromVault;
    }
    return process.env[apiKeyEnv];
  }

  async function apiKey(): Promise<string> {
    const key = await resolveKey();
    if (!key) {
      const src = opts.apiKeySecret ? `secret '${opts.apiKeySecret}' or env ${apiKeyEnv}` : `env ${apiKeyEnv}`;
      throw new ProviderError(`no API key (${src}) — provider unconfigured`, opts.id, false);
    }
    return key;
  }

  return {
    id: opts.id,
    kind: "anthropic",
    local: false,

    async *chatStream(
      req: ChatRequest,
      model: string,
      signal?: AbortSignal,
      target?: TargetOptions,
    ): AsyncGenerator<ChatEvent> {
      const { toWire, toReal } = buildToolNameMap(req.tools ?? []);
      const { system, messages } = toAnthropicPayload(req.messages, toWire);
      const adaptiveGen = ADAPTIVE_GEN.test(model);
      const thinking = thinkingField(model, Boolean(req.tools?.length), target?.thinking);
      const body = {
        model,
        // Adaptive-generation models spend thinking tokens inside max_tokens.
        max_tokens: req.maxTokens ?? (adaptiveGen ? 16000 : 4096),
        // Sampling params are HTTP-400 on adaptive-generation models; the hint
        // is dropped there rather than failing the whole call.
        ...(req.temperature !== undefined && !adaptiveGen ? { temperature: req.temperature } : {}),
        ...(thinking ? { thinking } : {}),
        ...(target?.effort && adaptiveGen ? { output_config: { effort: target.effort } } : {}),
        ...(system ? { system } : {}),
        messages,
        stream: true,
        ...(req.tools?.length
          ? {
              tools: req.tools.map((t) => ({
                name: toWire.get(t.name) ?? t.name,
                description: t.description,
                input_schema: t.inputSchema,
              })),
            }
          : {}),
      };

      const key = await apiKey();
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}),
        });
      } catch (err) {
        throw new ProviderError(
          `anthropic unreachable: ${err instanceof Error ? err.message : String(err)}`,
          opts.id,
          true,
        );
      }
      if (!res.ok || !res.body) {
        throw new ProviderError(
          `anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
          opts.id,
          res.status >= 500 || res.status === 429,
        );
      }

      const usage = { inputTokens: 0, outputTokens: 0 };
      let finishReason: "stop" | "tool_use" | "length" = "stop";
      // accumulating tool_use blocks: index -> {id,name,jsonText}
      const pendingTools = new Map<number, { id: string; name: string; jsonText: string }>();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
          const type = payload.type as string;

          if (type === "message_start") {
            const msg = payload.message as { usage?: { input_tokens?: number } };
            usage.inputTokens = msg.usage?.input_tokens ?? 0;
          } else if (type === "content_block_start") {
            const block = payload.content_block as { type: string; id?: string; name?: string };
            if (block.type === "tool_use") {
              const wireName = block.name ?? "";
              pendingTools.set(payload.index as number, {
                id: block.id ?? "",
                // restore J.A.R.V.I.S.'s real tool name (dots/colons) from the
                // wire-safe name Claude echoes back
                name: toReal.get(wireName) ?? wireName,
                jsonText: "",
              });
            }
          } else if (type === "content_block_delta") {
            const delta = payload.delta as { type: string; text?: string; partial_json?: string };
            if (delta.type === "text_delta" && delta.text) {
              yield { type: "text_delta", text: delta.text };
            } else if (delta.type === "input_json_delta") {
              const pending = pendingTools.get(payload.index as number);
              if (pending) pending.jsonText += delta.partial_json ?? "";
            }
          } else if (type === "content_block_stop") {
            const pending = pendingTools.get(payload.index as number);
            if (pending) {
              pendingTools.delete(payload.index as number);
              yield {
                type: "tool_call",
                call: {
                  id: pending.id,
                  name: pending.name,
                  arguments: pending.jsonText ? JSON.parse(pending.jsonText) : {},
                },
              };
            }
          } else if (type === "message_delta") {
            const delta = payload.delta as { stop_reason?: string };
            const u = payload.usage as { output_tokens?: number } | undefined;
            if (u?.output_tokens !== undefined) usage.outputTokens = u.output_tokens;
            if (delta.stop_reason === "tool_use") finishReason = "tool_use";
            else if (delta.stop_reason === "max_tokens") finishReason = "length";
          }
        }
      }
      yield { type: "done", finishReason, usage };
    },

    async ping(signal?: AbortSignal) {
      const key = await resolveKey();
      if (!key) {
        const src = opts.apiKeySecret ? `secret '${opts.apiKeySecret}' or env ${apiKeyEnv}` : `env ${apiKeyEnv}`;
        return { ok: false, detail: `no key (${src})` };
      }
      try {
        // models list is the cheapest authenticated probe
        const res = await fetch(`${baseUrl}/v1/models?limit=1`, {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          ...(signal ? { signal } : {}),
        });
        return { ok: res.ok, detail: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
