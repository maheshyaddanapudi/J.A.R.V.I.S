-- 0014_proactive_rules: user-defined proactivity rules (R-CAP-01 "rules" kind +
-- R-PRO). Makes WHAT J.A.R.V.I.S. is proactive about user-configurable instead of
-- hardcoded: the engine's built-in generators (overdue/due commitments, calendar
-- conflicts, briefing) still run; enabled rules add more candidates, each of which
-- still passes the SAME gate stack (quiet hours / priority / confidence / dedup /
-- rate-limit / snooze) and only ever SURFACES a suggestion — never acts (R-PRO).
--
-- The condition is a TYPED, closed set (`part_of_day`, `commitment_due_within`,
-- `commitment_overdue`) evaluated in code — NOT arbitrary expressions — so a rule
-- can never execute code or escape the read-only, suggestion-only contract.

CREATE TABLE proactive_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  domain      text NOT NULL DEFAULT 'general',
  priority    text NOT NULL DEFAULT 'normal',    -- low | normal | high | critical
  title       text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  confidence  real NOT NULL DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
  condition   jsonb NOT NULL,                    -- typed, closed-set condition
  provenance  text NOT NULL DEFAULT 'user',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX proactive_rules_name_idx ON proactive_rules (name);
CREATE INDEX proactive_rules_enabled_idx ON proactive_rules (enabled) WHERE enabled;
