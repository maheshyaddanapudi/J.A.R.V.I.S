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

## Verified (2026-07-17)
55 kernel tests incl. 7 vault + 3 memory-encryption. Live: DB holds `v1.gcm.…`,
grep for the plaintext secret = 0 rows, survives restart, wrong `JARVIS_MASTER_KEY`
→ kernel refuses to start with a clear error. Keyfile `0600`.

Note: whole-disk encryption (FileVault) is the Mac's outer layer; this adds
application-level field encryption on top (defense in depth).
