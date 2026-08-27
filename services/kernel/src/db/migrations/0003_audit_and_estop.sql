-- 0003_audit_and_estop: Z1 trust-core state (slice 1.4)

-- Hash-chained append-only action audit (R-SEC-03, THREAT_MODEL T11).
-- chain_hash = sha256(prev_chain_hash || canonical_json(row_payload)).
-- Verification walks the chain; any mutation breaks every subsequent hash.
CREATE TABLE audit_log (
  seq          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  actor        text NOT NULL,             -- 'kernel' | 'user' | tool/agent id
  event        text NOT NULL,             -- e.g. 'policy_decision','tool_call','approval','estop'
  payload      jsonb NOT NULL,            -- secret-redacted before write (R-MEM-06)
  prev_hash    text NOT NULL,             -- hex sha256 of previous row's chain_hash ('genesis' for seq 1)
  chain_hash   text NOT NULL
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX audit_log_event_idx ON audit_log (event, at DESC);

-- Emergency-stop latch (R-AUTO-03): single-row table; engaged survives restarts
-- and requires an explicit resume. Every executor polls / subscribes.
CREATE TABLE estop (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id), -- single row
  engaged      boolean NOT NULL DEFAULT false,
  engaged_at   timestamptz,
  engaged_via  text,                      -- which interface hit the stop
  resumed_at   timestamptz
);
INSERT INTO estop (id, engaged) VALUES (true, false);
