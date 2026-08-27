-- 0011_episodes: episodic memory — a durable, recallable TIMELINE of notable
-- events (Phase 2, "full memory store set"; parity H "Memory & knowledge").
--
-- Distinct from the audit log (audit is a SECURITY record: immutable, append-only,
-- sha256 hash-chained, never forgettable). This is a SEMANTIC memory J.A.R.V.I.S.
-- recalls in conversation — "earlier today you…", "the last time you edited that…"
-- — importance-ranked, forgettable, and encrypted at rest. It complements the
-- semantic store (entities/facts = what J.A.R.V.I.S. KNOWS ABOUT the world;
-- episodes = what HAPPENED over time). Reuses the epistemic_status + sensitivity
-- enums (0004) and the mandatory metadata every store carries (R-MEM-03/05).
--
-- Free-text content (summary / detail) is AES-256-GCM encrypted at rest when a
-- vault is present; detected secrets are redacted before write (R-MEM-06). `tags`
-- are categorical labels (plaintext) so they stay SQL-searchable; free-text query
-- filters run after decryption in the adapter (ciphertext is opaque to SQL, by
-- design — the same tradeoff as facts).

CREATE TABLE memory_episodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  kind          text NOT NULL DEFAULT 'note',   -- observation | action | decision | note | milestone
  summary       text NOT NULL,                  -- encrypted at rest
  detail        text NOT NULL DEFAULT '',       -- encrypted at rest
  entity_id     uuid REFERENCES memory_entities(id) ON DELETE SET NULL,
  importance    real NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
  tags          text[] NOT NULL DEFAULT '{}',
  status        epistemic_status NOT NULL DEFAULT 'user_statement',
  provenance    text NOT NULL,
  sensitivity   sensitivity NOT NULL DEFAULT 'personal',
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- recall is time-ordered; deleted episodes drop out of every read immediately.
CREATE INDEX memory_episodes_time_idx ON memory_episodes (occurred_at DESC)
  WHERE status <> 'deleted';
CREATE INDEX memory_episodes_kind_idx ON memory_episodes (kind)
  WHERE status <> 'deleted';
CREATE INDEX memory_episodes_entity_idx ON memory_episodes (entity_id)
  WHERE status <> 'deleted';
CREATE INDEX memory_episodes_tags_idx ON memory_episodes USING gin (tags);
