-- 0013_prompts: the PROMPTS registry — one of the R-CAP-01 "no fixed connector
-- list" entity kinds (registries for tools/models/MCP/capabilities/devices/skills
-- already exist; this adds prompts). Makes J.A.R.V.I.S.'s persona and named system
-- prompts a real, versioned, user-editable entity instead of a hardcoded string,
-- so the user controls how J.A.R.V.I.S. speaks (the "British-butler manner" is now
-- data, not code) — supersede-with-history like the other stores (R-MEM-05).
--
-- The conversation loop reads the ACTIVE `persona` prompt; if the registry is empty
-- or unavailable it falls back to the built-in default (never a blank persona).

CREATE TABLE prompts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  kind         text NOT NULL DEFAULT 'persona',  -- persona | system | template
  content      text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  version      int NOT NULL DEFAULT 1,
  provenance   text NOT NULL DEFAULT 'user',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- at most one ACTIVE prompt per (name, kind); supersede-old-first on update.
CREATE UNIQUE INDEX prompts_active_idx ON prompts (name, kind) WHERE active;
CREATE INDEX prompts_kind_idx ON prompts (kind) WHERE active;

-- Seed the default British-butler persona (D-0004) so the registry is populated on
-- first run and the loop has an active persona to read immediately.
INSERT INTO prompts (name, kind, content, provenance) VALUES (
  'butler',
  'persona',
  'You are J.A.R.V.I.S., a composed, dry-witted British butler-assistant. Be concise, precise, and understated. Address the user as ''sir'' sparingly. Never invent facts.',
  'default (D-0004)'
);
