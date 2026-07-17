-- 0006_proactive: proactivity engine (Phase 4 foundation)
-- Commitments/deadlines + calendar events the engine reasons over, the surfaced
-- proactive items, and per-item snooze/dismiss state.

CREATE TABLE commitments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  due_at       timestamptz NOT NULL,
  domain       text NOT NULL DEFAULT 'general',   -- gates apply per-domain
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  provenance   text NOT NULL DEFAULT 'user',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commitments_due_idx ON commitments (due_at) WHERE status = 'open';

CREATE TABLE calendar_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  domain       text NOT NULL DEFAULT 'calendar',
  provenance   text NOT NULL DEFAULT 'user',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_events_start_idx ON calendar_events (starts_at);

-- Surfaced proactive items (only those that passed every gate).
CREATE TABLE proactive_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,          -- deadline_due | commitment_overdue | calendar_conflict | briefing
  priority     text NOT NULL CHECK (priority IN ('low','normal','high','critical')),
  domain       text NOT NULL,
  title        text NOT NULL,
  detail       text NOT NULL,
  confidence   real NOT NULL,
  why          text NOT NULL,          -- "why am I seeing this" explanation
  dedup_key    text NOT NULL,          -- suppresses repeats
  created_at   timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);
CREATE INDEX proactive_items_created_idx ON proactive_items (created_at DESC);
CREATE UNIQUE INDEX proactive_items_dedup_idx ON proactive_items (dedup_key);

-- Snooze / dismiss / per-domain enable state.
CREATE TABLE proactive_snoozes (
  dedup_key    text PRIMARY KEY,
  snoozed_until timestamptz,
  dismissed    boolean NOT NULL DEFAULT false
);

CREATE TABLE proactive_domain_settings (
  domain       text PRIMARY KEY,
  enabled      boolean NOT NULL DEFAULT true
);
