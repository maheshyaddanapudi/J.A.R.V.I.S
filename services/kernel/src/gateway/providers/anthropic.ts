import type { ProviderAdapter } from "../provider.js";
import { ProviderError } from "../provider.js";
import type { ChatEvent, ChatRequest, NeutralMessage } from "../schema.js";

/**
 * Anthropic Messages API adapter (the "one cloud adapter" of slice 1.2).
 * Remote provider: local=false — the router refuses it for LOCAL_ONLY payloads
 * and in offline mode. API key comes from the environment at call time; it is
 * never logged, stored, or echoed (R-MEM-06).
 */

function toAnthropicPayload(messages: NeutralMessage[]) {
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
                name: c.name,
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

    async *chatStream(req: ChatRequest, model: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
      const { system, messages } = toAnthropicPayload(req.messages);
      const body = {
        model,
        max_tokens: req.maxTokens ?? 4096,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(system ? { system } : {}),
        messages,
        stream: true,
        ...(req.tools?.length
          ? {
              tools: req.tools.map((t) => ({
                name: t.name,
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
              pendingTools.set(payload.index as number, {
                id: block.id ?? "",
                name: block.name ?? "",
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
