import { z } from "zod";

/**
 * Neutral message/tool schema (R-MODEL-02). Core logic speaks ONLY these types;
 * provider adapters are the only code that knows provider wire formats.
 */

export const ModelRoles = [
  "fast_conversation",
  "deep_reasoning",
  "coding",
  "vision",
  "stt",
  "tts",
  "embeddings",
  "reranking",
  "planning",
  "verification",
  "safety_review",
  "tool_selection",
  "agent_routing",
  "long_context",
  "local_fallback",
] as const;
export type ModelRole = (typeof ModelRoles)[number];

/**
 * Privacy classification (R-LOC-02, THREAT_MODEL T14).
 * LOCAL_ONLY payloads may never be routed to a remote provider.
 */
export type PrivacyClass = "LOCAL_ONLY" | "STANDARD";

export interface TextPart {
  type: "text";
  text: string;
}
export interface ImagePart {
  type: "image";
  mediaType: string;
  /** base64 payload — always local data */
  data: string;
}
export type ContentPart = TextPart | ImagePart;

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export type NeutralMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: ContentPart[] }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for arguments */
  inputSchema: Record<string, unknown>;
}

export interface ChatRequest {
  role: ModelRole;
  messages: NeutralMessage[];
  tools?: ToolDefinition[];
  /** JSON Schema the final assistant text must validate against (structured output). */
  responseSchema?: Record<string, unknown>;
  privacyClass: PrivacyClass;
  maxTokens?: number;
  temperature?: number;
  /** originator for audit/policy (e.g. 'core-loop', 'test') */
  source: string;
}

export type ChatEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | {
      type: "done";
      finishReason: "stop" | "tool_use" | "length" | "error";
      usage: { inputTokens: number; outputTokens: number };
    }
  | { type: "error"; message: string };

export interface ChatResult {
  text: string;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_use" | "length" | "error";
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  model: string;
  latencyMs: number;
  /** set when a fallback chain was exercised */
  fallbackFrom?: string[];
}

/** Runtime validation for role config files. */
export const RoleTargetSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  /** Reasoning-effort dial (Anthropic `output_config.effort`; providers/models
   *  without the knob ignore it). */
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  /** Extended thinking. Only the adaptive shape exists on current Anthropic
   *  models — the old `budget_tokens` shape is HTTP-400 there (verified
   *  2026-07-18), so it is deliberately not expressible here. */
  thinking: z.literal("adaptive").optional(),
});
export type RoleTarget = z.infer<typeof RoleTargetSchema>;

/** Per-target generation hints the router forwards to the chosen adapter. */
export type TargetOptions = Pick<RoleTarget, "effort" | "thinking">;

export const GatewayConfigSchema = z.object({
  providers: z.record(
    z.string(),
    z.object({
      kind: z.enum(["ollama", "anthropic", "openai_compat"]),
      baseUrl: z.string().url().optional(),
      /** name of a secret in the managed SecretsVault holding the API key (preferred,
       *  R-MEM-06/D-0028) — resolved at call time, never stored in config */
      apiKeySecret: z.string().optional(),
      /** name of env var holding the API key — fallback when no vault/secret is set */
      apiKeyEnv: z.string().optional(),
      /** local = reachable without leaving the machine; gates LOCAL_ONLY + offline mode */
      local: z.boolean(),
    }),
  ),
  /** Partial: unconfigured roles route to `local_fallback` (R-MODEL-04). */
  roles: z.partialRecord(z.enum(ModelRoles), z.array(RoleTargetSchema).min(1)),
});
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
