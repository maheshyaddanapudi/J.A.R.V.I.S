import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { createServer } from "./http/server.js";
import { loadGatewayConfig } from "./gateway/config.js";
import { GatewayRouter } from "./gateway/router.js";
import { buildCore } from "./core/index.js";
import { Vault } from "./crypto/vault.js";
import { resolveKek } from "./crypto/kek.js";
import { SecretsVault } from "./crypto/secrets.js";
import { AuditLog } from "./core/audit.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "db", "migrations");
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string };

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const startedAt = Date.now();

const migrated = await runMigrations(pool, migrationsDir);

// Open the local encrypted vault (R-MEM-03). KEK from macOS Keychain on the Mac,
// HKDF(JARVIS_MASTER_KEY) in dev. The wrapped DEK lives under the local data dir.
// Opened before the gateway so provider adapters can resolve API keys from the
// managed SecretsVault (R-MEM-06/D-0028) instead of raw process env.
const keyfile = join(homedir(), ".jarvis", "vault", "dek.json");
const vault = await Vault.open(keyfile, await resolveKek());
const secrets = new SecretsVault(pool, vault, new AuditLog(pool));

const gatewayConfig = await loadGatewayConfig(config.gatewayConfigPath || undefined);
const gateway = new GatewayRouter(gatewayConfig, pool, config.offline, secrets);

const workspaceRoot = config.workspaceRoot || join(homedir(), ".jarvis", "workspace");

const core = await buildCore({ pool, gateway, workspaceRoot, vault, secrets, offline: config.offline });

const app = createServer({
  config,
  pool,
  migrationsDir,
  version: pkg.version,
  startedAt,
  gateway,
  core,
});

await pool.query(
  "INSERT INTO system_events (source, kind, detail) VALUES ($1, $2, $3)",
  [
    "kernel",
    "startup",
    JSON.stringify({
      version: pkg.version,
      migrationsApplied: migrated.applied,
      env: config.env,
    }),
  ],
);

// Locality rule R-LOC-01: loopback only — not configurable in Phase 1.
await app.listen({ port: config.httpPort, host: "127.0.0.1" });
app.log.info(`jarvisd kernel listening on 127.0.0.1:${config.httpPort}`);

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  try {
    await pool.query(
      "INSERT INTO system_events (source, kind, detail) VALUES ('kernel','shutdown',$1)",
      [JSON.stringify({ signal })],
    );
  } catch {
    // best effort — DB may already be gone
  }
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
