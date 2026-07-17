import { defineConfig } from "vitest/config";

/**
 * The kernel's integration tests all share ONE Postgres database (`jarvis_test`),
 * and several files reset shared tables in `beforeEach` (e.g. both memory and
 * context truncate `preferences`). Running test files in parallel therefore lets
 * one file's TRUNCATE wipe another file's freshly-inserted rows mid-test — a race
 * that surfaces as intermittent "expected 1, got 0" failures.
 *
 * Serialize test files (`fileParallelism: false`) so the shared-DB suite is
 * deterministic. Tests WITHIN a file still run in order; only cross-file overlap
 * is removed. The suite is fast enough (~10-15s) that this costs little.
 * (migrate.test.ts additionally isolates itself in a private schema.)
 */
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
