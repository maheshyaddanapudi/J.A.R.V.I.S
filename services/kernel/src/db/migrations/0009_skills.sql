-- 0009_skills: user-defined skills registry (R-CAP-01 — registries for entity
-- kinds; this is the "skills" registry). A skill is a saved, named objective the
-- user can re-run through the agent runtime; execution still goes through the
-- gated core loop (a skill grants no new capability, only reuses existing ones).

CREATE TABLE skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  objective    text NOT NULL,                 -- the natural-language task run via the agent
  max_steps    integer NOT NULL DEFAULT 6 CHECK (max_steps BETWEEN 1 AND 20),
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  last_run_at  timestamptz
);
-- one active skill per name
CREATE UNIQUE INDEX skills_name_idx ON skills (name) WHERE enabled = true;
