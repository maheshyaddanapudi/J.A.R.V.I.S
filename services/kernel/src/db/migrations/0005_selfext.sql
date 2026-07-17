-- 0005_selfext: self-extension registries (Phase 3 foundation)
-- Stage A only: capabilities are RECORDED, never activated. No activation state
-- may be set without the dedicated security check-in (R-CAP-05).

-- Capability lifecycle states. Note: 'installed'/'active' are DEFINED but the
-- code has NO path to set them yet — that path is built only after the check-in.
CREATE TYPE capability_state AS ENUM (
  'gap_recorded',     -- a missing capability was detected & recorded (pre-Phase-3 safe)
  'stage_a_generated',-- generated in sandbox, NOT activated
  'scanned_clean',    -- passed the guard (hard limit + scans)
  'scanned_rejected', -- failed the hard limit or a reject-severity scan
  'awaiting_review',  -- ready for the human security check-in
  'approved',         -- human-approved at the check-in (still not installed)
  'installed',        -- (post-check-in only; no code path yet)
  'active',           -- (post-check-in only; no code path yet)
  'rolled_back',
  'disabled'
);

CREATE TABLE capability_gaps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  need         text NOT NULL,             -- what capability was missing
  context      text NOT NULL,             -- where the gap surfaced
  searched_existing boolean NOT NULL DEFAULT false,
  resolved     boolean NOT NULL DEFAULT false
);

CREATE TABLE capabilities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  version      text NOT NULL,
  state        capability_state NOT NULL DEFAULT 'stage_a_generated',
  risk_class   text NOT NULL,
  manifest_hash text NOT NULL,            -- sha256 of the canonical manifest
  permissions  text[] NOT NULL DEFAULT '{}',
  provenance   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- how/why generated, sources
  report       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- human-readable capability report
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
CREATE INDEX capabilities_state_idx ON capabilities (state);
