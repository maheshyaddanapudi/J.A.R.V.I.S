-- 0022_announcements: outbound initiative (D-0068) — J.A.R.V.I.S. deciding to
-- SPEAK, not just wait to be asked. Two kinds share one queue:
--   'say'     — an unprompted announcement ("Sir, incoming call from Pepper")
--   'concern' — advisory DISSENT about an action ("I'd advise against that, sir")
-- Urgency gates quiet-hours suppression (non-urgent held, urgent breaks through).
-- Delivery (TTS on the Mac / UI + notification in the container) marks delivered.

CREATE TABLE announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at            timestamptz NOT NULL DEFAULT now(),
  kind          text NOT NULL DEFAULT 'say'    CHECK (kind IN ('say','concern')),
  urgency       text NOT NULL DEFAULT 'info'   CHECK (urgency IN ('info','advisory','urgent')),
  text          text NOT NULL,                 -- what J.A.R.V.I.S. wants to say (encrypted-at-rest not needed: non-secret by contract; redacted on write)
  about         text NOT NULL DEFAULT '',      -- the action/subject a concern is about
  recommendation text NOT NULL DEFAULT '',     -- for a concern: what it advises instead
  source        text NOT NULL,                 -- heartbeat | conversation | proactive | …
  dedupe_key    text,                          -- collapse repeats within a window
  deferred      boolean NOT NULL DEFAULT false,-- held for quiet hours (non-urgent)
  delivered_at  timestamptz,
  dismissed_at  timestamptz
);
CREATE INDEX announcements_pending_idx ON announcements (at DESC)
  WHERE delivered_at IS NULL AND dismissed_at IS NULL;
