# kernel/src/crypto — local encrypted vault (R-MEM-03/06)

Field-level encryption-at-rest for memory. Nothing sensitive is ever stored in
Postgres in the clear, and no key material lives in the DB.

## Key hierarchy
- **KEK** (key-encryption-key) — `kek.ts`. macOS: from the login Keychain
  (`security`, generated once). dev/container: HKDF(`JARVIS_MASTER_KEY`). Refuses
  to run in `JARVIS_ENV=prod` without a real key; a loudly-non-secret dev default
  lets `make dev` work out of the box.
- **DEK** (data-encryption-key) — 256-bit, generated once, AES-256-GCM-wrapped by
  the KEK, stored `0600` at `~/.jarvis/vault/dek.json`. Unwrapped in memory at
  boot.

## Vault (`vault.ts`)
- `encrypt` → `v1.gcm.<nonce>.<ct>.<tag>` (random 96-bit nonce per value; GCM
  auth tag → tampering detected on decrypt).
- **Wrong KEK is fatal**: if the keyfile exists but won't unwrap, `open()` throws
  rather than silently re-keying (which would orphan all ciphertext). First run
  (no keyfile) generates + wraps a fresh DEK.

## What's encrypted
MemoryService (given a Vault): conversation content, and preference values with
sensitivity `private`/`secret`. `personal`/`public` values stay plaintext so
content search works. Callers always see plaintext; the DB holds ciphertext.

## SecretsVault (`secrets.ts`) — managed integration credentials (R-MEM-06)
The goal's mandate: secrets NEVER live in conversational memory — they live in
an encrypted, keychain-backed vault. This is that store (migration 0008,
`integration_secrets`). Adapters (gateway API keys, HA token, MCP server env)
resolve credentials from here instead of raw `process.env`.
- `set/get/has/list/delete` + `resolveEnv({ENV: name})` for subprocess env.
- **Requires a Vault** — constructing without one throws, so a secret can never
  be stored in the clear. `buildCore` only creates it when a vault is present.
- The DB holds only `v1.gcm.…` ciphertext (grep = 0 plaintext, tested).
- `get()`/`resolveEnv()` return plaintext ONLY to in-process adapters; there is
  deliberately **no HTTP route that returns a value**. Routes: `GET /secrets`
  (names + metadata only), `POST /secrets` (set), `DELETE /secrets/:name`.
- The **audit records the name + operation, never the value** (`secret_set`,
  `secret_accessed`, `secret_deleted`). Verified live: value absent from audit.
- `/mcp/connect` accepts `secretEnv: {ENV_VAR: secretName}` so a server's
  credentials are pulled from the vault, never sent in the request body; a
  missing secret fails closed.

## Verified (2026-07-17)
55 kernel tests incl. 7 vault + 3 memory-encryption. Live: DB holds `v1.gcm.…`,
grep for the plaintext secret = 0 rows, survives restart, wrong `JARVIS_MASTER_KEY`
→ kernel refuses to start with a clear error. Keyfile `0600`.

Live-verified (2026-07-17): store a secret → DB holds ciphertext only (0
plaintext rows), list returns names only, MCP `secretEnv` resolves from the
vault (missing → fail closed), the secret value never appears in the audit,
delete works. 7 SecretsVault tests (`test/secrets.test.ts`).

Note: whole-disk encryption (FileVault) is the Mac's outer layer; this adds
application-level field encryption on top (defense in depth).
