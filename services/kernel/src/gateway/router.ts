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
  RoleTarget,
  ToolCall,
} from "./schema.js";

/** Canonical pin string for a target: provider/model[@effort][+thinking|+nothink]. */
export function pinOf(t: RoleTarget): string {
  return `${t.provider}/${t.model}${t.effort ? `@${t.effort}` : ""}${
    t.thinking === "off" ? "+nothink" : t.thinking ? "+thinking" : ""
  }`;
}
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
/** Runtime role override with its ledger (D-0053/D-0054): who set it, why,
 *  when. Only "user"-sourced today — the sleep cycle PROPOSES pins; applying
 *  one is a user action (consequential changes need approval, R-AUTO). */
export interface RoleOverride {
  targets: RoleTarget[];
  reason: string;
  at: string;
}

export class GatewayRouter {
  private adapters = new Map<string, ProviderAdapter>();
  private roleOverrides = new Map<ModelRole, RoleOverride>();

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

  /** Configured-or-overridden targets for a role (no gating applied). */
  private resolveTargets(role: ModelRole): RoleTarget[] | undefined {
    return this.roleOverrides.get(role)?.targets ?? this.config.roles[role];
  }

  /**
   * Runtime role override (D-0054): re-route a role among the ALREADY
   * CONFIGURED providers without a restart. Structurally cannot widen the
   * egress surface (unknown providers refused — adding a provider endpoint
   * stays a config-file + restart concern) and cannot bypass privacy/offline
   * gating (applied downstream in eligibleTargets, override or not).
   */
  overrideRole(
    role: ModelRole,
    targets: RoleTarget[],
    ledger: { reason: string; at?: string },
  ): RoleOverride {
    if (!targets.length) throw new Error(`override for '${role}' needs at least one target`);
    for (const t of targets) {
      if (!this.adapters.has(t.provider)) {
        throw new Error(
          `unknown provider '${t.provider}' (configured: ${[...this.adapters.keys()].join(", ")})`,
        );
      }
    }
    const entry: RoleOverride = {
      targets,
      reason: ledger.reason,
      at: ledger.at ?? new Date().toISOString(),
    };
    this.roleOverrides.set(role, entry);
    return entry;
  }

  clearRoleOverride(role: ModelRole): boolean {
    return this.roleOverrides.delete(role);
  }

  /** Current overrides with their ledgers, pins in the canonical syntax. */
  overrides(): Record<string, { pins: string[]; reason: string; at: string }> {
    return Object.fromEntries(
      [...this.roleOverrides.entries()].map(([role, o]) => [
        role,
        { pins: o.targets.map(pinOf), reason: o.reason, at: o.at },
      ]),
    );
  }

  /** Targets for a role after privacy/offline gating. Order = preference (local-first by config). */
  eligibleTargets(role: ModelRole, privacyClass: ChatRequest["privacyClass"]) {
    const targets = this.resolveTargets(role) ?? this.resolveTargets("local_fallback");
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
        // legacy "adaptive" alias normalizes to neutral "on" (config load also
        // normalizes; this is defense in depth for programmatic configs)
        const thinking = target.thinking === "adaptive" ? "on" : target.thinking;
        const targetOpts = {
          ...(target.effort ? { effort: target.effort } : {}),
          ...(thinking ? { thinking } : {}),
        };
        for await (const event of adapter.chatStream(req, target.model, signal, targetOpts)) {
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
    const roles = new Set<string>([...Object.keys(this.config.roles), ...this.roleOverrides.keys()]);
    return Object.fromEntries(
      [...roles].map((role) => {
        const active =
          this.roleOverrides.get(role as ModelRole)?.targets ??
          this.config.roles[role as ModelRole] ??
          [];
        return [role, active.map(pinOf)];
      }),
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
