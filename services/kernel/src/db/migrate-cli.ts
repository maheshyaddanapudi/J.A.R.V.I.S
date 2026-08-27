import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig } from "../config.js";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

const config = loadConfig();
const pool = createPool(config.databaseUrl);
try {
  const result = await runMigrations(pool, migrationsDir);
  for (const f of result.applied) console.log(`applied  ${f}`);
  for (const f of result.alreadyApplied) console.log(`ok       ${f}`);
  if (result.applied.length === 0) console.log("database is up to date");
} finally {
  await pool.end();
}
