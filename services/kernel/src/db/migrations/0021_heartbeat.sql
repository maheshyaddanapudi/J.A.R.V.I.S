-- 0021_heartbeat: the living heartbeat (D-0064).
-- agenda_items — J.A.R.V.I.S.'s OWN intention ledger: what it means to do next,
-- written by itself (conversation or heartbeat), the user, or the sleep cycle.
-- Dual-editable (D-0053): visible, addable, completable, droppable by both.
-- heartbeats — the per-tick journal: what actually happened at each beat, so
-- "alive between conversations" is observable, not asserted.

CREATE TABLE agenda_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  what        text NOT NULL,
  why         text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','dropped')),
  due_at      timestamptz,                    -- null = next heartbeat
  outcome     text NOT NULL DEFAULT '',       -- filled when completed/dropped
  provenance  text NOT NULL,                  -- who wrote it (jarvis-heartbeat | jarvis-conversation | user | sleep-cycle)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agenda_items_pending_idx ON agenda_items (created_at) WHERE status = 'pending';

CREATE TABLE heartbeats (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at                 timestamptz NOT NULL DEFAULT now(),
  proactive_surfaced int  NOT NULL DEFAULT 0,
  consolidated       boolean NOT NULL DEFAULT false,
  agenda_reviewed    int  NOT NULL DEFAULT 0,
  agenda_completed   int  NOT NULL DEFAULT 0,
  brain_used         boolean NOT NULL DEFAULT false,
  summary            text NOT NULL DEFAULT '',   -- J.A.R.V.I.S.'s own one-liner for the beat
  detail             text NOT NULL DEFAULT ''    -- step trace / notes (bounded)
);
CREATE INDEX heartbeats_at_idx ON heartbeats (at DESC);
