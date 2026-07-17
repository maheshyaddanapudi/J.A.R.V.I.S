import type { ProviderAdapter } from "../provider.js";
import { ProviderError } from "../provider.js";
import type { ChatEvent, ChatRequest, NeutralMessage } from "../schema.js";

/**
 * OpenAI-compatible chat-completions adapter (R-MODEL-02). Covers OpenAI itself
 * plus the many local runtimes speaking this dialect (llama.cpp server, vLLM,
 * LM-Studio-style endpoints). `local` comes from config: a llama.cpp server on
 * 127.0.0.1 is local; api.openai.com is not.
 */

function toOpenAiMessages(messages: NeutralMessage[]) {
  return messages.map((m) => {
    switch (m.role) {
      case "system":
        return { role: "system" as const, content: m.content };
      case "user":
        return {
          role: "user" as const,
          content: m.content.map((p) =>
            p.type === "text"
              ? { type: "text" as const, text: p.text }
              : {
                  type: "image_url" as const,
                  image_url: { url: `data:${p.mediaType};base64,${p.data}` },
                },
          ),
        };
      case "assistant":
        return {
          role: "assistant" as const,
          content: m.content || null,
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((c) => ({
                  id: c.id,
                  type: "function" as const,
                  function: { name: c.name, arguments: JSON.stringify(c.arguments) },
                })),
              }
            : {}),
        };
      case "tool":
        return { role: "tool" as const, tool_call_id: m.toolCallId, content: m.content };
    }
  });
}

export function createOpenAiCompatAdapter(opts: {
  id: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  local: boolean;
}): ProviderAdapter {
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  function authHeaders(): Record<string, string> {
    if (!opts.apiKeyEnv) return {};
    const key = process.env[opts.apiKeyEnv];
    return key ? { authorization: `Bearer ${key}` } : {};
  }

  return {
    id: opts.id,
    kind: "openai_compat",
    local: opts.local,

    async *chatStream(req: ChatRequest, model: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
      const body = {
        model,
        messages: toOpenAiMessages(req.messages),
        stream: true,
        stream_options: { include_usage: true },
        ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.tools?.length
          ? {
              tools: req.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.inputSchema },
              })),
            }
          : {}),
        ...(req.responseSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: "response", schema: req.responseSchema },
              },
            }
          : {}),
      };

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders() },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}),
        });
      } catch (err) {
        throw new ProviderError(
          `${opts.id} unreachable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
          opts.id,
          true,
        );
      }
      if (!res.ok || !res.body) {
        throw new ProviderError(
          `${opts.id} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
          opts.id,
          res.status >= 500 || res.status === 429,
        );
      }

      const usage = { inputTokens: 0, outputTokens: 0 };
      let finishReason: "stop" | "tool_use" | "length" = "stop";
      const pendingTools = new Map<number, { id: string; name: string; argsText: string }>();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          const chunk = JSON.parse(data) as {
            choices?: {
              index: number;
              delta?: {
                content?: string;
                tool_calls?: {
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }[];
              };
              finish_reason?: string | null;
            }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
          };
          const choice = chunk.choices?.[0];
          if (choice?.delta?.content) yield { type: "text_delta", text: choice.delta.content };
          for (const tc of choice?.delta?.tool_calls ?? []) {
            const existing = pendingTools.get(tc.index) ?? { id: "", name: "", argsText: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.argsText += tc.function.arguments;
            pendingTools.set(tc.index, existing);
          }
          if (choice?.finish_reason === "tool_calls") finishReason = "tool_use";
          else if (choice?.finish_reason === "length") finishReason = "length";
          if (chunk.usage) {
            usage.inputTokens = chunk.usage.prompt_tokens ?? 0;
            usage.outputTokens = chunk.usage.completion_tokens ?? 0;
          }
        }
      }
      for (const [, t] of pendingTools) {
        yield {
          type: "tool_call",
          call: { id: t.id, name: t.name, arguments: t.argsText ? JSON.parse(t.argsText) : {} },
        };
      }
      yield { type: "done", finishReason, usage };
    },

    async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ model, input: texts }),
        ...(signal ? { signal } : {}),
      });
      if (!res.ok) {
        throw new ProviderError(`${opts.id} embeddings HTTP ${res.status}`, opts.id, res.status >= 500);
      }
      const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },

    async ping(signal?: AbortSignal) {
      try {
        const res = await fetch(`${baseUrl}/models`, {
          headers: authHeaders(),
          ...(signal ? { signal } : {}),
        });
        return { ok: res.ok, detail: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
