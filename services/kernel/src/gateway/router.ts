import type pg from "pg";
import Ajv from "ajv";
import type { ProviderAdapter } from "./provider.js";
import { ProviderError } from "./provider.js";
import type {
  ChatEvent,
  ChatRequest,
  ChatResult,
  GatewayConfig,
  ModelRole,
  ToolCall,
} from "./schema.js";
import { createOllamaAdapter } from "./providers/ollama.js";
import { createAnthropicAdapter } from "./providers/anthropic.js";
import { createOpenAiCompatAdapter } from "./providers/openaiCompat.js";

const ajv = new (Ajv as unknown as typeof Ajv.default)({ allErrors: true, strict: false });

/**
 * The gateway router owns: role→target resolution, LOCAL-CAPABLE-FIRST policy
 * (targets are ordered local-first in config), privacy gating (LOCAL_ONLY never
 * leaves the machine — R-LOC-02), offline mode (remote refused entirely),
 * fallback chains, structured-output validation, and the model_calls audit.
 */
export class GatewayRouter {
  private adapters = new Map<string, ProviderAdapter>();

  constructor(
    private readonly config: GatewayConfig,
    private readonly pool: pg.Pool,
    private readonly offline: boolean,
    /** managed secrets vault: adapters resolve API keys from here first (R-MEM-06/D-0028) */
    secrets?: { get(name: string): Promise<string | undefined> },
  ) {
    const resolveSecret = secrets ? (name: string) => secrets.get(name) : undefined;
    for (const [id, p] of Object.entries(config.providers)) {
      const common = { id, ...(p.baseUrl ? { baseUrl: p.baseUrl } : {}) };
      const creds = {
        ...(p.apiKeySecret ? { apiKeySecret: p.apiKeySecret } : {}),
        ...(p.apiKeyEnv ? { apiKeyEnv: p.apiKeyEnv } : {}),
        ...(resolveSecret ? { resolveSecret } : {}),
      };
      if (p.kind === "ollama") {
        this.adapters.set(id, createOllamaAdapter({ ...common, local: p.local }));
      } else if (p.kind === "anthropic") {
        this.adapters.set(id, createAnthropicAdapter({ ...common, ...creds }));
      } else {
        this.adapters.set(id, createOpenAiCompatAdapter({ ...common, local: p.local, ...creds }));
      }
    }
  }

  get isOffline(): boolean {
    return this.offline;
  }

  /** Targets for a role after privacy/offline gating. Order = preference (local-first by config). */
  eligibleTargets(role: ModelRole, privacyClass: ChatRequest["privacyClass"]) {
    const targets = this.config.roles[role] ?? this.config.roles.local_fallback;
    if (!targets?.length) {
      throw new Error(`no targets configured for role '${role}' (and no local_fallback)`);
    }
    return targets.filter((t) => {
      const adapter = this.adapters.get(t.provider);
      if (!adapter) return false;
      if (this.offline && !adapter.local) return false;
      if (privacyClass === "LOCAL_ONLY" && !adapter.local) return false;
      return true;
    });
  }

  /**
   * Streaming chat with fallback. Fallback happens only on transport-level
   * failures BEFORE any content has streamed (mid-stream failures surface as
   * errors — silently switching models mid-answer would be dishonest).
   */
  async *chatStream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent, ChatResult> {
    const targets = this.eligibleTargets(req.role, req.privacyClass);
    if (targets.length === 0) {
      const reason = this.offline
        ? `offline mode: no local provider configured for role '${req.role}'`
        : `privacy class ${req.privacyClass}: no eligible provider for role '${req.role}'`;
      await this.audit(req, null, null, 0, { ok: false, error: reason, fallbacks: [] });
      throw new Error(reason);
    }

    const fallbackFrom: string[] = [];
    let lastError: unknown;

    for (const target of targets) {
      const adapter = this.adapters.get(target.provider)!;
      const started = Date.now();
      let text = "";
      const toolCalls: ToolCall[] = [];
      let usage = { inputTokens: 0, outputTokens: 0 };
      let finishReason: ChatResult["finishReason"] = "stop";
      let streamedAnything = false;

      try {
        for await (const event of adapter.chatStream(req, target.model, signal)) {
          if (event.type === "text_delta") {
            streamedAnything = true;
            text += event.text;
            yield event;
          } else if (event.type === "tool_call") {
            streamedAnything = true;
            toolCalls.push(event.call);
            yield event;
          } else if (event.type === "done") {
            usage = event.usage;
            finishReason = event.finishReason;
            yield event;
          }
        }

        if (req.responseSchema && finishReason === "stop") {
          this.validateStructured(text, req.responseSchema);
        }

        const latencyMs = Date.now() - started;
        const result: ChatResult = {
          text,
          toolCalls,
          finishReason,
          usage,
          provider: target.provider,
          model: target.model,
          latencyMs,
          ...(fallbackFrom.length ? { fallbackFrom } : {}),
        };
        await this.audit(req, target.provider, target.model, latencyMs, {
          ok: true,
          usage,
          fallbacks: fallbackFrom,
        });
        return result;
      } catch (err) {
        lastError = err;
        const retryable = err instanceof ProviderError && err.retryable && !streamedAnything;
        await this.audit(req, target.provider, target.model, Date.now() - started, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          fallbacks: fallbackFrom,
        });
        if (!retryable) throw err;
        fallbackFrom.push(`${target.provider}/${target.model}`);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`all providers failed for role '${req.role}'`);
  }

  /** Convenience: drain the stream and return the final result. */
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const gen = this.chatStream(req, signal);
    while (true) {
      const step = await gen.next();
      if (step.done) return step.value;
    }
  }

  async embed(texts: string[], privacyClass: ChatRequest["privacyClass"], source: string): Promise<{
    embeddings: number[][];
    provider: string;
    model: string;
  }> {
    const targets = this.eligibleTargets("embeddings", privacyClass);
    let lastError: unknown;
    for (const target of targets) {
      const adapter = this.adapters.get(target.provider)!;
      if (!adapter.embed) continue;
      const started = Date.now();
      try {
        const embeddings = await adapter.embed(texts, target.model);
        await this.audit(
          { role: "embeddings", privacyClass, source },
          target.provider,
          target.model,
          Date.now() - started,
          { ok: true, usage: { inputTokens: 0, outputTokens: 0 }, fallbacks: [] },
        );
        return { embeddings, provider: target.provider, model: target.model };
      } catch (err) {
        lastError = err;
        await this.audit(
          { role: "embeddings", privacyClass, source },
          target.provider,
          target.model,
          Date.now() - started,
          { ok: false, error: err instanceof Error ? err.message : String(err), fallbacks: [] },
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("no embedding-capable provider eligible");
  }

  async status(): Promise<
    { provider: string; kind: string; local: boolean; ok: boolean; detail: string }[]
  > {
    return Promise.all(
      [...this.adapters.values()].map(async (a) => {
        if (this.offline && !a.local) {
          return {
            provider: a.id,
            kind: a.kind,
            local: a.local,
            ok: false,
            detail: "disabled: offline mode",
          };
        }
        const ping = await a.ping();
        return { provider: a.id, kind: a.kind, local: a.local, ...ping };
      }),
    );
  }

  roleTable() {
    return Object.fromEntries(
      Object.entries(this.config.roles).map(([role, targets]) => [
        role,
        targets.map((t) => `${t.provider}/${t.model}`),
      ]),
    );
  }

  private validateStructured(text: string, schema: Record<string, unknown>): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("structured output invalid: response is not JSON");
    }
    const validate = ajv.compile(schema);
    if (!validate(parsed)) {
      throw new Error(`structured output failed schema: ${ajv.errorsText(validate.errors)}`);
    }
  }

  /**
   * model_calls audit (R-MODEL-03): role, provider, model, privacy class,
   * tokens, latency, outcome. Message CONTENT is deliberately not stored here —
   * conversation persistence with its own retention rules arrives in 1.6.
   */
  private async audit(
    req: Pick<ChatRequest, "role" | "privacyClass" | "source">,
    provider: string | null,
    model: string | null,
    latencyMs: number,
    outcome:
      | { ok: true; usage: { inputTokens: number; outputTokens: number }; fallbacks: string[] }
      | { ok: false; error: string; fallbacks: string[] },
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO model_calls
           (role, provider, model, privacy_class, source, ok, error,
            input_tokens, output_tokens, latency_ms, fallback_from, offline_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          req.role,
          provider,
          model,
          req.privacyClass,
          req.source,
          outcome.ok,
          outcome.ok ? null : outcome.error.slice(0, 1000),
          outcome.ok ? outcome.usage.inputTokens : 0,
          outcome.ok ? outcome.usage.outputTokens : 0,
          Math.round(latencyMs),
          outcome.fallbacks,
          this.offline,
        ],
      );
    } catch {
      // Audit failure must not corrupt the user-facing stream; the DB being
      // down is already visible in /health. (Hash-chained action audit with
      // hard guarantees arrives in slice 1.4 for tool execution.)
    }
  }
}
