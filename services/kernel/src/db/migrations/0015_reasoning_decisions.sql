-- 0015_reasoning_decisions: deep-reasoning decision journal (D-0051)
-- J.A.R.V.I.S. records ITS OWN routing decisions so the sleep-cycle
-- consolidation can learn from them. Deliberately CATEGORICAL ONLY — the
-- reason is a closed enum, never conversation content, so nothing here needs
-- encryption (the conversation itself lives in encrypted conversation memory).

CREATE TABLE reasoning_decisions (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  requested text NOT NULL,   -- auto | deep | fast   (what the caller asked for)
  mode      text NOT NULL,   -- deep | fast          (what was decided)
  -- closed set: explicit_ask | learned_topic | signals | single_signal |
  --             routine | override | correction_promoted | downgrade_ineligible
  reason    text NOT NULL,
  role      text NOT NULL    -- fast_conversation | deep_reasoning
);

CREATE INDEX reasoning_decisions_at_idx ON reasoning_decisions (at DESC);
