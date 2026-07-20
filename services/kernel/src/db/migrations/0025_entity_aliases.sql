-- 0025_entity_aliases: name-variant entity resolution (D-0075). The 70/30
-- observation run showed the model naming the same real-world thing
-- inconsistently across stateless sessions ('Pepper' vs 'Pepper Potts'),
-- leaving duplicate active entities that never merged. rememberEntity now asks
-- the fast model whether a similarly-named mention is the SAME thing; when it
-- is, the mention's info accrues to the canonical entity and the variant
-- spelling is recorded here as an alias so recall by EITHER name resolves to
-- the one entity. Aliases are stored lowercased for case-insensitive matching.
ALTER TABLE memory_entities ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';

-- GIN index so `aliases && ARRAY[lower($1)]` (alias lookup) stays index-backed
-- as the brain grows.
CREATE INDEX IF NOT EXISTS memory_entities_aliases_idx ON memory_entities USING gin (aliases);
