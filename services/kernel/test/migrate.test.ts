import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { listMigrationFiles, runMigrations, migrationStatus } from "../src/db/migrate.js";

// Integration tests — require a reachable Postgres (JARVIS_TEST_DATABASE_URL
// or the dev default). Skipped, loudly, when no database is available.
const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";

let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  // leave pool undefined
}

describe.skipIf(!pool)("migration runner (integration)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "jarvis-mig-"));
    await pool!.query("DROP TABLE IF EXISTS schema_migrations, mig_a CASCADE");
    await writeFile(join(dir, "0001_a.sql"), "CREATE TABLE mig_a (id int primary key);");
    await writeFile(join(dir, "0002_b.sql"), "ALTER TABLE mig_a ADD COLUMN name text;");
  });

  afterAll(async () => {
    await pool?.query("DROP TABLE IF EXISTS schema_migrations, mig_a CASCADE");
    await pool?.end();
  });

  it("applies migrations in order, exactly once", async () => {
    const first = await runMigrations(pool!, dir);
    expect(first.applied).toEqual(["0001_a.sql", "0002_b.sql"]);

    const second = await runMigrations(pool!, dir);
    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toEqual(["0001_a.sql", "0002_b.sql"]);

    const status = await migrationStatus(pool!, dir);
    expect(status).toMatchObject({ total: 2, applied: 2, pending: [] });
  });

  it("hard-fails when an applied migration file is mutated", async () => {
    await writeFile(join(dir, "0001_a.sql"), "-- tampered\nSELECT 1;");
    await expect(runMigrations(pool!, dir)).rejects.toThrow(/immutable/);
  });
});

describe("listMigrationFiles", () => {
  it("only accepts NNNN_name.sql and sorts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jarvis-miglist-"));
    await writeFile(join(dir, "0002_b.sql"), "");
    await writeFile(join(dir, "0001_a.sql"), "");
    await writeFile(join(dir, "README.md"), "");
    await writeFile(join(dir, "01_bad.sql"), "");
    expect(await listMigrationFiles(dir)).toEqual(["0001_a.sql", "0002_b.sql"]);
  });
});
