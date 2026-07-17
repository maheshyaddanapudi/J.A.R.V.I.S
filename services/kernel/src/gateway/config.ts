import { readFile } from "node:fs/promises";
import { GatewayConfigSchema, type GatewayConfig } from "./schema.js";

/**
 * Gateway config: providers + role routing table. Read from a JSON file so the
 * user can swap providers per role without touching code (Phase-1 acceptance:
 * provider swap via config alone). Registry-backed config arrives in Phase 3.
 *
 * LOCAL-CAPABLE-FIRST (R-MODEL-04) is expressed by ordering: for each role,
 * list local targets before remote ones. The router honors the order.
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  providers: {
    ollama: { kind: "ollama", baseUrl: "http://127.0.0.1:11434", local: true },
    // Prefer the managed SecretsVault (R-MEM-06); env is the fallback if unset.
    anthropic: {
      kind: "anthropic",
      apiKeySecret: "anthropic_api_key",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      local: false,
    },
  },
  roles: {
    fast_conversation: [
      { provider: "ollama", model: "qwen3.6:35b-a3b" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    ],
    deep_reasoning: [
      { provider: "ollama", model: "gpt-oss:120b" },
      { provider: "anthropic", model: "claude-sonnet-5" },
    ],
    embeddings: [{ provider: "ollama", model: "nomic-embed-text" }],
    local_fallback: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    tool_selection: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    // Remaining roles resolve to local_fallback until their phases configure them.
    coding: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    vision: [{ provider: "ollama", model: "gemma4:26b-a4b" }],
    stt: [{ provider: "ollama", model: "unused-see-speech-service" }],
    tts: [{ provider: "ollama", model: "unused-see-speech-service" }],
    reranking: [{ provider: "ollama", model: "nomic-embed-text" }],
    planning: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    verification: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    safety_review: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    agent_routing: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
    long_context: [{ provider: "ollama", model: "qwen3.6:35b-a3b" }],
  },
};

export async function loadGatewayConfig(path: string | undefined): Promise<GatewayConfig> {
  if (!path) return DEFAULT_GATEWAY_CONFIG;
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  const parsed = GatewayConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid gateway config at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}
