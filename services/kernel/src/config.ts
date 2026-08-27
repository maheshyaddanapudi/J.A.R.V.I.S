import { z } from "zod";

/**
 * Kernel configuration. Sourced from environment variables (12-factor for dev;
 * the packaged macOS app writes a launchd-managed env file).
 *
 * Locality rule (R-LOC-01): defaults bind everything to 127.0.0.1. There is
 * deliberately no config knob for a non-loopback bind in Phase 1.
 */
const ConfigSchema = z.object({
  env: z.enum(["dev", "test", "prod"]).default("dev"),
  httpPort: z.coerce.number().int().min(1).max(65535).default(4150),
  databaseUrl: z
    .string()
    .default("postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis"),
  /** OTLP HTTP endpoint; empty string disables trace export (offline mode stays clean). */
  otlpEndpoint: z.string().default(""),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Offline mode (R-MODEL-04): remote providers refused entirely. */
  offline: z
    .string()
    .default("")
    .transform((v) => v === "1" || v.toLowerCase() === "true"),
  /** Path to gateway config JSON; empty = built-in local-first defaults. */
  gatewayConfigPath: z.string().default(""),
  /** Workspace root the reversible workspace tool is scoped to. */
  workspaceRoot: z.string().default(""),
});

export type KernelConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): KernelConfig {
  const parsed = ConfigSchema.safeParse({
    env: env.JARVIS_ENV,
    httpPort: env.JARVIS_KERNEL_PORT,
    databaseUrl: env.JARVIS_DATABASE_URL,
    otlpEndpoint: env.JARVIS_OTLP_ENDPOINT,
    logLevel: env.JARVIS_LOG_LEVEL,
    offline: env.JARVIS_OFFLINE,
    gatewayConfigPath: env.JARVIS_GATEWAY_CONFIG,
    workspaceRoot: env.JARVIS_WORKSPACE,
  });
  if (!parsed.success) {
    throw new Error(`Invalid kernel configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}
