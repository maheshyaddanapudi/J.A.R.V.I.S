import type { ProviderAdapter } from "../provider.js";
import { ProviderError } from "../provider.js";
import type { ChatEvent, ChatRequest, NeutralMessage, ToolCall } from "../schema.js";

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[];
  tool_calls?: { function: { name: string; arguments: unknown } }[];
}

function toOllamaMessages(messages: NeutralMessage[]): OllamaMessage[] {
  return messages.map((m): OllamaMessage => {
    switch (m.role) {
      case "system":
        return { role: "system", content: m.content };
      case "user": {
        const text = m.content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
        const images = m.content.filter((p) => p.type === "image").map((p) => p.data);
        return { role: "user", content: text, ...(images.length ? { images } : {}) };
      }
      case "assistant":
        return {
          role: "assistant",
          content: m.content,
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((c) => ({
                  function: { name: c.name, arguments: c.arguments },
                })),
              }
            : {}),
        };
      case "tool":
        return { role: "tool", content: m.content };
    }
  });
}

export function createOllamaAdapter(opts: {
  id: string;
  baseUrl?: string;
  local: boolean;
}): ProviderAdapter {
  const baseUrl = (opts.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");

  return {
    id: opts.id,
    kind: "ollama",
    local: opts.local,

    async *chatStream(req: ChatRequest, model: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
      const body = {
        model,
        messages: toOllamaMessages(req.messages),
        stream: true,
        ...(req.tools?.length
          ? {
              tools: req.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.inputSchema },
              })),
            }
          : {}),
        ...(req.responseSchema ? { format: req.responseSchema } : {}),
        options: {
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.maxTokens !== undefined ? { num_predict: req.maxTokens } : {}),
        },
      };

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}),
        });
      } catch (err) {
        throw new ProviderError(
          `ollama unreachable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
          opts.id,
          true,
        );
      }
      if (!res.ok || !res.body) {
        throw new ProviderError(
          `ollama HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
          opts.id,
          res.status >= 500 || res.status === 429,
        );
      }

      const usage = { inputTokens: 0, outputTokens: 0 };
      let sawToolCall = false;
      let callSeq = 0;
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
          if (!line) continue;
          const chunk = JSON.parse(line) as {
            message?: {
              content?: string;
              tool_calls?: { function: { name: string; arguments: unknown } }[];
            };
            done?: boolean;
            prompt_eval_count?: number;
            eval_count?: number;
          };
          if (chunk.message?.content) yield { type: "text_delta", text: chunk.message.content };
          for (const tc of chunk.message?.tool_calls ?? []) {
            sawToolCall = true;
            const call: ToolCall = {
              id: `${opts.id}-${Date.now()}-${callSeq++}`,
              name: tc.function.name,
              arguments: tc.function.arguments,
            };
            yield { type: "tool_call", call };
          }
          if (chunk.done) {
            usage.inputTokens = chunk.prompt_eval_count ?? 0;
            usage.outputTokens = chunk.eval_count ?? 0;
          }
        }
      }
      yield { type: "done", finishReason: sawToolCall ? "tool_use" : "stop", usage };
    },

    async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
      const res = await fetch(`${baseUrl}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: texts }),
        ...(signal ? { signal } : {}),
      });
      if (!res.ok) {
        throw new ProviderError(`ollama embed HTTP ${res.status}`, opts.id, res.status >= 500);
      }
      const data = (await res.json()) as { embeddings: number[][] };
      return data.embeddings;
    },

    async ping(signal?: AbortSignal) {
      try {
        const res = await fetch(`${baseUrl}/api/version`, signal ? { signal } : {});
        return res.ok
          ? { ok: true, detail: `ollama ${((await res.json()) as { version?: string }).version ?? "?"}` }
          : { ok: false, detail: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
