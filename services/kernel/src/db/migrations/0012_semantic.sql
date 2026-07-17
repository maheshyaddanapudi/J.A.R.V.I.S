-- 0012_semantic: vector index over memory for SEMANTIC ("perfect") recall — the
-- remaining piece of parity H1. J.A.R.V.I.S. can already recall by exact name
-- (entities) and free-text substring (episodes/conversation); this adds recall by
-- MEANING ("what did we discuss about the reactor" matching without the word).
--
-- Uses pgvector (enabled in 0001) + the model gateway's embeddings role
-- (nomic-embed-text, 768-dim, D-0012). The index is DECOUPLED from the content
-- tables (memory_episodes / memory_facts / …) so:
--   1. any memory item can be indexed and re-embedded without touching its row,
--   2. a missing/offline embedder never blocks a memory write — the row is stored
--      and simply not indexed until an embedder is available (graceful fallback to
--      lexical recall), and
--   3. switching embedding models just re-indexes (rows are keyed by model).
--
-- Dimension is fixed at 768 (nomic-embed-text, the configured default). The `dim`
-- column records the actual vector length so a model/dimension mismatch is caught
-- and skipped rather than corrupting the index. Single-user corpora stay small, so
-- exact cosine KNN (ORDER BY embedding <=> query) is used — no ANN index needed
-- (one can be added later with pgvector hnsw if the corpus grows).

CREATE TABLE memory_embeddings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind  text NOT NULL,             -- episode | fact | entity | conversation
  source_id    uuid NOT NULL,
  model        text NOT NULL,
  dim          int  NOT NULL,
  embedding    vector(768) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- one embedding per (item, model); re-indexing upserts.
CREATE UNIQUE INDEX memory_embeddings_src_idx ON memory_embeddings (source_kind, source_id, model);
CREATE INDEX memory_embeddings_kind_idx ON memory_embeddings (source_kind);
