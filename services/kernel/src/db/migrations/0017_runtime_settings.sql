-- 0017_runtime_settings: general runtime settings overlay (D-0058)
--
-- The Command Center is a live command center, not a start-time-only config
-- screen: any registered setting is editable at runtime. This table stores
-- ONLY the deltas — a persisted override for a key, with its ledger (who set
-- it, why, when). The effective value is `override ?? current default`, so a
-- key with no row simply uses whatever the code/config default is right now
-- (defaults can evolve underneath overrides; nothing is a frozen snapshot).
--
-- Z1 trust-core settings (policy/approval/audit/e-stop/credentials/sandbox) are
-- deliberately NOT in the settings catalog and therefore cannot be written here
-- (R-CAP-08) — the catalog is the allowlist.

CREATE TABLE runtime_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  source     text NOT NULL,            -- 'user' | 'jarvis'
  reason     text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
