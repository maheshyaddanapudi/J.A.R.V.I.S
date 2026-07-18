import { readFile } from "node:fs/promises";
import {
  EffortLevels,
  GatewayConfigSchema,
  ModelRoles,
  type EffortLevel,
  type GatewayConfig,
  type ModelRole,
  type RoleTarget,
} from "./schema.js";

/**
 * Gateway config: providers + role routing table. Read from a JSON file so the
 * user can swap providers per role without touching code (Phase-1 acceptance:
 * provider swap via config alone). Registry-backed config arrives in Phase 3.
 *
 * LOCAL-CAPABLE-FIRST (R-MODEL-04) is expressed by ordering: for each role,
 * list local targets before remote ones. The router honors the order.
 *
 * PROVIDER-AGNOSTIC USER CONTROLS (D-0049) — resolved here, at load time, so
 * the outcome is inspectable in /gateway/roles and the /models panel:
 *   JARVIS_EFFORT=low|medium|high|xhigh|max
 *       default `effort` for anthropic/openai_compat targets that don't set one
 *   JARVIS_THINKING=on|off
 *       default `thinking` for anthropic/openai_compat targets that don't set one
 *       (Ollama stays per-target opt-in: it hard-errors on models without
 *        thinking support, so a global default could break the local path)
 *   JARVIS_ROLE_<ROLE>=provider/model[@effort][+thinking|+nothink]
 *       pin a role to one target, e.g.
 *       JARVIS_ROLE_DEEP_REASONING=anthropic/claude-sonnet-5@xhigh+thinking
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
      { provider: "ollama", model: "gpt-oss:120b", thinking: "on", effort: "high" },
      { provider: "anthropic", model: "claude-sonnet-5", effort: "xhigh", thinking: "on" },
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

/** Provider kinds where a global effort/thinking default is safe to apply
 *  (an unsupported value fails VISIBLY per remote call; Ollama instead
 *  hard-errors on non-thinking local models, so it stays per-target). */
const ENV_DEFAULT_KINDS = new Set(["anthropic", "openai_compat"]);

/** Roles that never generate chat text — reasoning knobs are meaningless there
 *  and must not decorate the role table (they'd mislead in /models). */
const NON_GENERATIVE_ROLES = new Set(["embeddings", "reranking", "stt", "tts"]);

function parseRolePin(role: string, raw: string): RoleTarget {
  let rest = raw.trim();
  let thinking: RoleTarget["thinking"];
  if (rest.endsWith("+thinking")) { thinking = "on"; rest = rest.slice(0, -"+thinking".length); }
  else if (rest.endsWith("+nothink")) { thinking = "off"; rest = rest.slice(0, -"+nothink".length); }
  let effort: EffortLevel | undefined;
  const at = rest.lastIndexOf("@");
  if (at > 0) {
    const maybe = rest.slice(at + 1);
    if ((EffortLevels as readonly string[]).includes(maybe)) {
      effort = maybe as EffortLevel;
      rest = rest.slice(0, at);
    }
  }
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash === rest.length - 1) {
    throw new Error(
      `JARVIS_ROLE_${role.toUpperCase()}: expected provider/model[@effort][+thinking|+nothink], got '${raw}'`,
    );
  }
  return {
    provider: rest.slice(0, slash),
    model: rest.slice(slash + 1),
    ...(effort ? { effort } : {}),
    ...(thinking ? { thinking } : {}),
  };
}

/**
 * Normalize a parsed config and apply the provider-agnostic env controls.
 * Pure (env passed in) so it is directly testable.
 */
export function resolveGatewayConfig(
  cfg: GatewayConfig,
  env: Record<string, string | undefined> = process.env,
): GatewayConfig {
  const envEffort = env.JARVIS_EFFORT;
  if (envEffort && !(EffortLevels as readonly string[]).includes(envEffort)) {
    throw new Error(`JARVIS_EFFORT must be one of ${EffortLevels.join("|")}, got '${envEffort}'`);
  }
  const envThinking = env.JARVIS_THINKING;
  if (envThinking && envThinking !== "on" && envThinking !== "off") {
    throw new Error(`JARVIS_THINKING must be on|off, got '${envThinking}'`);
  }

  const roles: GatewayConfig["roles"] = {};
  for (const [role, targets] of Object.entries(cfg.roles)) {
    roles[role as ModelRole] = targets!.map((t) => {
      const kind = cfg.providers[t.provider]?.kind;
      const defaultable =
        kind !== undefined && ENV_DEFAULT_KINDS.has(kind) && !NON_GENERATIVE_ROLES.has(role);
      // legacy alias: "adaptive" (the Anthropic term) means our neutral "on"
      const thinking = t.thinking === "adaptive" ? "on" : t.thinking;
      return {
        ...t,
        ...(thinking ? { thinking } : {}),
        ...(t.effort === undefined && defaultable && envEffort
          ? { effort: envEffort as EffortLevel }
          : {}),
        ...(thinking === undefined && defaultable && envThinking
          ? { thinking: envThinking as "on" | "off" }
          : {}),
      };
    });
  }

  // JARVIS_ROLE_<ROLE> pins a role to a single explicit target.
  for (const role of ModelRoles) {
    const raw = env[`JARVIS_ROLE_${role.toUpperCase()}`];
    if (!raw) continue;
    const pin = parseRolePin(role, raw);
    if (!cfg.providers[pin.provider]) {
      throw new Error(
        `JARVIS_ROLE_${role.toUpperCase()}: unknown provider '${pin.provider}' (configured: ${Object.keys(cfg.providers).join(", ")})`,
      );
    }
    roles[role] = [pin];
  }

  return { providers: cfg.providers, roles };
}

export async function loadGatewayConfig(path: string | undefined): Promise<GatewayConfig> {
  if (!path) return resolveGatewayConfig(DEFAULT_GATEWAY_CONFIG);
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  const parsed = GatewayConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid gateway config at ${path}: ${parsed.error.message}`);
  }
  return resolveGatewayConfig(parsed.data);
}
