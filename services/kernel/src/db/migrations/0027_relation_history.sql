-- 0027_relation_history: supersede-with-history for RELATIONS (Longitude-XL
-- gap G-07, 2026-09-11). Relations had no history: teaching "quinn ferreira
-- maintains weather mast north" beside an older "diego mbeki maintains weather
-- mast north" simply left both edges, and the agent then answered "not found —
-- maintained by diego mbeki, not quinn ferreira" or refused on two located_in
-- links. Exclusive relations (a thing is in ONE place; a device has ONE
-- maintainer of record) now REPLACE the previous edge, and the displaced edge
-- moves here — readers of memory_relations keep seeing only current edges,
-- nothing is deleted from the record, and the audit names the change.
CREATE TABLE IF NOT EXISTS memory_relation_history (
  id            uuid PRIMARY KEY,                 -- the retired edge's own id
  from_entity   uuid NOT NULL,
  to_entity     uuid NOT NULL,
  relation      text NOT NULL,
  note          text NOT NULL DEFAULT '',
  provenance    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL,             -- when the edge was first recorded
  superseded_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid,                             -- the edge that replaced it (may be null for a reconciliation)
  reason        text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS memory_relation_history_from_idx ON memory_relation_history (from_entity);
CREATE INDEX IF NOT EXISTS memory_relation_history_to_idx ON memory_relation_history (to_entity);
