-- 0010_entities: semantic knowledge store — entities, facts, relations (Phase 2,
-- "persistent encrypted memory / full store set"; parity H "Memory & knowledge").
-- A knowledge-graph-lite so J.A.R.V.I.S. durably KNOWS ABOUT the user's world
-- (people, projects, places, things). Reuses the epistemic_status + sensitivity
-- enums (0004) and the mandatory metadata every store carries (R-MEM-03/05).
-- Free-text content (attributes / statement / note) is AES-256-GCM encrypted at
-- rest when a vault is present; names are plaintext for lookup + the unique index
-- (same tradeoff as preferences.key).

CREATE TABLE memory_entities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL,                 -- person | project | place | org | thing | topic
  name          text NOT NULL,
  attributes    text NOT NULL DEFAULT '',      -- encrypted JSON blob at rest
  status        epistemic_status NOT NULL DEFAULT 'user_statement',
  provenance    text NOT NULL,
  confidence    real NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  sensitivity   sensitivity NOT NULL DEFAULT 'personal',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  superseded_by uuid REFERENCES memory_entities(id)
);
-- one active entity per (name, kind); supersede-old-first on re-remember.
CREATE UNIQUE INDEX memory_entities_active_name_idx
  ON memory_entities (lower(name), kind)
  WHERE status <> 'deleted' AND status <> 'superseded';
CREATE INDEX memory_entities_kind_idx ON memory_entities (kind)
  WHERE status <> 'deleted' AND status <> 'superseded';

CREATE TABLE memory_facts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  statement     text NOT NULL,                 -- encrypted at rest
  status        epistemic_status NOT NULL DEFAULT 'user_statement',
  provenance    text NOT NULL,
  confidence    real NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  sensitivity   sensitivity NOT NULL DEFAULT 'personal',
  created_at    timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid REFERENCES memory_facts(id)
);
CREATE INDEX memory_facts_entity_idx ON memory_facts (entity_id)
  WHERE status <> 'deleted' AND status <> 'superseded';

CREATE TABLE memory_relations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity   uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  to_entity     uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  relation      text NOT NULL,                 -- works_on | knows | located_in | owns | part_of | ...
  note          text NOT NULL DEFAULT '',      -- encrypted at rest
  provenance    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX memory_relations_from_idx ON memory_relations (from_entity);
CREATE INDEX memory_relations_to_idx ON memory_relations (to_entity);
CREATE UNIQUE INDEX memory_relations_unique_idx ON memory_relations (from_entity, to_entity, relation);
