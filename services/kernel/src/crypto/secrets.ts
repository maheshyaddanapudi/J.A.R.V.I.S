import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { Vault } from "./vault.js";

/**
 * Managed integration-credential store (R-MEM-06, credential storage is a
 * protected Z1 path). The goal's mandate: secrets NEVER live in conversational
 * memory — they live in an encrypted, keychain-backed vault. This is that store.
 *
 * Guarantees:
 *  - Values are AES-256-GCM ciphertext at rest (via `Vault`); the DB holds no
 *    plaintext. A vault is REQUIRED — constructing without one throws, so a
 *    secret can never be stored in the clear.
 *  - `get()` returns plaintext ONLY to in-process adapters (gateway, HA, MCP).
 *    There is deliberately no HTTP route that returns a value.
 *  - The audit records the secret's NAME and the operation, NEVER the value.
 *  - `list()` returns names + metadata only.
 */
export interface SecretInfo {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

export class SecretsVault {
  constructor(
    private readonly pool: pg.Pool,
    private readonly vault: Vault,
    private readonly audit: AuditLog,
  ) {
    if (!vault) throw new Error("SecretsVault requires a vault — secrets are never stored in the clear");
  }

  /** Store (or replace) a named secret. The value is encrypted before it touches the DB. */
  async set(name: string, value: string, description = ""): Promise<void> {
    const key = normalizeName(name);
    const ciphertext = this.vault.encrypt(value);
    await this.pool.query(
      `INSERT INTO integration_secrets (name, ciphertext, description, updated_at)
       VALUES ($1,$2,$3, now())
       ON CONFLICT (name) DO UPDATE SET
         ciphertext = EXCLUDED.ciphertext,
         description = EXCLUDED.description,
         updated_at = now()`,
      [key, ciphertext, description],
    );
    // NAME + description only — never the value.
    await this.audit.append({ actor: "user", event: "secret_set", payload: { name: key, description } });
  }

  /**
   * Resolve a secret's plaintext for an in-process adapter. Records access by
   * name (not value). Returns undefined if the secret is absent.
   */
  async get(name: string): Promise<string | undefined> {
    const key = normalizeName(name);
    const { rows } = await this.pool.query<{ ciphertext: string }>(
      "SELECT ciphertext FROM integration_secrets WHERE name = $1",
      [key],
    );
    const row = rows[0];
    if (!row) return undefined;
    await this.pool.query("UPDATE integration_secrets SET last_accessed_at = now() WHERE name = $1", [key]);
    await this.audit.append({ actor: "kernel", event: "secret_accessed", payload: { name: key } });
    return this.vault.decrypt(row.ciphertext);
  }

  async has(name: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ one: number }>(
      "SELECT 1 AS one FROM integration_secrets WHERE name = $1",
      [normalizeName(name)],
    );
    return rows.length > 0;
  }

  /** Names + metadata only — never values. Safe to render in the UI. */
  async list(): Promise<SecretInfo[]> {
    const { rows } = await this.pool.query<{
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
      last_accessed_at: string | null;
    }>(
      `SELECT name, description, created_at::text, updated_at::text, last_accessed_at::text
         FROM integration_secrets ORDER BY name`,
    );
    return rows.map((r) => ({
      name: r.name,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastAccessedAt: r.last_accessed_at,
    }));
  }

  async delete(name: string): Promise<boolean> {
    const key = normalizeName(name);
    const { rowCount } = await this.pool.query("DELETE FROM integration_secrets WHERE name = $1", [key]);
    if (rowCount) {
      await this.audit.append({ actor: "user", event: "secret_deleted", payload: { name: key } });
    }
    return Boolean(rowCount);
  }

  /**
   * Resolve a map of {ENV_VAR: secretName} into a plaintext env object for a
   * subprocess (e.g. an MCP server). Missing secrets throw — fail closed rather
   * than launch a server without the credential it needs. The plaintext exists
   * only in the returned object (handed straight to the child process env).
   */
  async resolveEnv(map: Record<string, string>): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [envVar, secretName] of Object.entries(map)) {
      const value = await this.get(secretName);
      if (value === undefined) throw new Error(`secret '${secretName}' (for env ${envVar}) is not set`);
      out[envVar] = value;
    }
    return out;
  }
}

function normalizeName(name: string): string {
  const n = name.trim();
  if (!n || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(n)) {
    throw new Error("secret name must be 1–128 chars of [a-zA-Z0-9_.:-]");
  }
  return n;
}
