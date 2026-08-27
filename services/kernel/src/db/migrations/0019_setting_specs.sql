-- 0019_setting_specs: dynamically-registered settings (D-0060)
--
-- The static catalog (code) defines SYSTEM settings — the mandatory floor:
-- always present, editable, "delete" just resets them to their default. But
-- J.A.R.V.I.S. may discover a NEW configurable thing at runtime (its own
-- evolution) that the user wants surfaced, edited, and removed. Those dynamic
-- specs live here (persisted, so they survive restart) and are fully deletable.
--
-- A dynamic spec can never define a Z1 key (the registry refuses Z1-shaped keys
-- on register) — the catalog + this table together are the allowlist (R-CAP-08).

CREATE TABLE setting_specs (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  category    text NOT NULL DEFAULT 'General',
  type        text NOT NULL,               -- number | boolean | string | enum | hour
  default_val jsonb NOT NULL,
  description text NOT NULL DEFAULT '',
  min_val     double precision,
  max_val     double precision,
  step_val    double precision,
  options     jsonb,                        -- for enum
  created_by  text NOT NULL DEFAULT 'jarvis',
  created_at  timestamptz NOT NULL DEFAULT now()
);
