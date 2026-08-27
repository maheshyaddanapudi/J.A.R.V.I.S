-- 0004_memory: conversation + preference stores (slice 1.6)
-- The full 24-store set (PRODUCT_SPEC §7.1) lands across Phase 1/2; this slice
-- covers the two Phase-1 stores with the mandatory metadata every store carries.

-- Epistemic status is a first-class enum (R-MEM-05): retrieval and prompts must
-- distinguish these. No row may exist without one.
CREATE TYPE epistemic_status AS ENUM (
  'verified_fact',
  'user_statement',
  'external_claim',
  'inferred_preference',
  'temporary_context',
  'simulated_data',
  'uncertain',
  'superseded',
  'deleted'
);

CREATE TYPE sensitivity AS ENUM ('public', 'personal', 'private', 'secret');

-- Conversation store: turns of dialogue with the user.
CREATE TABLE conversation_memory (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('user','assistant')),
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  provenance   text NOT NULL DEFAULT 'conversation',
  sensitivity  sensitivity NOT NULL DEFAULT 'personal'
);
CREATE INDEX conversation_memory_session_idx ON conversation_memory (session_id, created_at);

-- Preference / semantic store with the full mandatory metadata (R-MEM-03).
CREATE TABLE preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL,
  value         text NOT NULL,
  status        epistemic_status NOT NULL DEFAULT 'user_statement',
  provenance    text NOT NULL,                 -- how we learned it
  confidence    real NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  sensitivity   sensitivity NOT NULL DEFAULT 'personal',
  pinned        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  expires_at    timestamptz,                   -- retention (null = no expiry)
  -- soft-delete: 'deleted' rows are excluded from retrieval immediately and
  -- purged physically on forget()/vacuum (R-MEM-04).
  superseded_by uuid REFERENCES preferences(id)
);
CREATE UNIQUE INDEX preferences_active_key_idx
  ON preferences (key) WHERE status <> 'deleted' AND status <> 'superseded';
CREATE INDEX preferences_status_idx ON preferences (status);
