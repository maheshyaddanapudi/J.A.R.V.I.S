import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { SecretsVault } from "../src/crypto/secrets.js";
import { Vault } from "../src/crypto/vault.js";
import type { AuditLog } from "../src/core/audit.js";

const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";

let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* no DB → this suite skips */
}

// Capture what actually reaches the audit log so we can prove no value leaks.
const auditPayloads: Record<string, unknown>[] = [];
const audit = {
  append: vi.fn(async (e: { payload: Record<string, unknown> }) => {
    auditPayloads.push(e.payload);
    return { seq: auditPayloads.length, chainHash: "x" };
  }),
} as unknown as AuditLog;

async function makeVault(): Promise<Vault> {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-secrets-"));
  return Vault.open(join(dir, "dek.json"), randomBytes(32));
}

afterAll(async () => {
  await pool?.end();
});

describe.skipIf(!pool)("SecretsVault (encrypted integration-credential store)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE integration_secrets");
    auditPayloads.length = 0;
  });

  it("requires a vault — never stores a secret in the clear", () => {
    expect(() => new SecretsVault(pool!, undefined as unknown as Vault, audit)).toThrow(/vault/i);
  });

  it("stores the value as ciphertext at rest (no plaintext in the DB)", async () => {
    const vault = await makeVault();
    const sv = new SecretsVault(pool!, vault, audit);
    await sv.set("anthropic_api_key", "sk-super-secret-value-123", "provider key");

    const { rows } = await pool!.query<{ ciphertext: string }>(
      "SELECT ciphertext FROM integration_secrets WHERE name = 'anthropic_api_key'",
    );
    expect(rows[0]!.ciphertext).toMatch(/^v1\.gcm\./);
    expect(rows[0]!.ciphertext).not.toContain("sk-super-secret-value-123");

    // and it round-trips back to plaintext for an adapter
    expect(await sv.get("anthropic_api_key")).toBe("sk-super-secret-value-123");
  });

  it("never writes the secret value to the audit log (name + op only)", async () => {
    const vault = await makeVault();
    const sv = new SecretsVault(pool!, vault, audit);
    await sv.set("token", "hunter2-the-actual-secret", "test");
    await sv.get("token");
    const dumped = JSON.stringify(auditPayloads);
    expect(dumped).not.toContain("hunter2-the-actual-secret");
    expect(dumped).toContain("token"); // the name is recorded
    expect(auditPayloads.some((p) => p["name"] === "token")).toBe(true);
  });

  it("list() returns names + metadata, never values", async () => {
    const vault = await makeVault();
    const sv = new SecretsVault(pool!, vault, audit);
    await sv.set("a", "secret-A", "first");
    await sv.set("b", "secret-B", "second");
    const list = await sv.list();
    expect(list.map((s) => s.name).sort()).toEqual(["a", "b"]);
    const dumped = JSON.stringify(list);
    expect(dumped).not.toContain("secret-A");
    expect(dumped).not.toContain("secret-B");
    expect(list.find((s) => s.name === "a")!.description).toBe("first");
  });

  it("set() replaces an existing secret; delete() removes it", async () => {
    const vault = await makeVault();
    const sv = new SecretsVault(pool!, vault, audit);
    await sv.set("k", "v1");
    await sv.set("k", "v2");
    expect(await sv.get("k")).toBe("v2");
    expect(await sv.has("k")).toBe(true);
    expect(await sv.delete("k")).toBe(true);
    expect(await sv.has("k")).toBe(false);
    expect(await sv.get("k")).toBeUndefined();
    expect(await sv.delete("k")).toBe(false); // already gone
  });

  it("resolveEnv maps {ENV: secretName} to plaintext; missing secret fails closed", async () => {
    const vault = await makeVault();
    const sv = new SecretsVault(pool!, vault, audit);
    await sv.set("ha_token", "llat-abc123");
    const env = await sv.resolveEnv({ HA_TOKEN: "ha_token" });
    expect(env).toEqual({ HA_TOKEN: "llat-abc123" });
    await expect(sv.resolveEnv({ MISSING: "nope" })).rejects.toThrow(/not set/);
  });

  it("rejects malformed secret names", async () => {
    const vault = await makeVault();
    const sv = new SecretsVault(pool!, vault, audit);
    await expect(sv.set("bad name!", "x")).rejects.toThrow(/secret name/);
  });
});
