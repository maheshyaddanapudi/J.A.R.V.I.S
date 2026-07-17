-- 0001_init: kernel base schema (slice 1.1)
-- Only what this slice actually uses: extension check + system event journal.
-- Conversation/memory/audit tables land with their slices (1.4/1.6).

CREATE EXTENSION IF NOT EXISTS vector;

-- Append-only system event journal: process starts/stops, migration runs,
-- health transitions. This is operational telemetry, distinct from the
-- hash-chained action audit log that arrives in slice 1.4.
CREATE TABLE system_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  source     text NOT NULL,            -- e.g. 'kernel'
  kind       text NOT NULL,            -- e.g. 'startup', 'shutdown', 'migrations_applied'
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX system_events_at_idx ON system_events (at DESC);
