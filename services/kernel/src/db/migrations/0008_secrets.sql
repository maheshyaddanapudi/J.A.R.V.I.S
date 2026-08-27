-- 0008_secrets: managed integration-credential store (secrets vault).
-- The goal's security mandate: secrets NEVER live in conversational memory —
-- they live in an encrypted, keychain-backed vault. This table holds ONLY
-- opaque AES-256-GCM ciphertext (wrapped by the DEK, KEK from Keychain/env);
-- grep it and there is no plaintext. Values are never returned over HTTP and
-- never written to the audit log — only the secret's name/metadata is.
-- R-MEM-06 / THREAT_MODEL (credential storage is a protected Z1 path).

CREATE TABLE integration_secrets (
  name           text PRIMARY KEY,                 -- caller-chosen id, e.g. 'anthropic_api_key'
  ciphertext     text NOT NULL,                    -- v1.gcm.<nonce>.<ct>.<tag> — opaque
  description    text NOT NULL DEFAULT '',         -- what it's for (safe to display)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz                      -- when an adapter last read it
);
