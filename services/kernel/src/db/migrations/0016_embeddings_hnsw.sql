-- 0016_embeddings_hnsw: ANN index for recall-by-meaning at brain scale (D-0057)
--
-- The brain graph's vector recall (SemanticMemory.search) ordered by cosine
-- distance `embedding <=> $query`. Without an index that is a Seq Scan over
-- every embedding — fine at hundreds, but linear: measured ~14 ms at 2.6 k
-- vectors, so ~140 ms at 26 k and ~1.4 s at 260 k. A long-lived personal brain
-- accumulates across years of sessions, so we add the HNSW ANN index pgvector
-- provides (the 0012 comment anticipated exactly this).
--
-- `vector_cosine_ops` matches the `<=>` operator the search uses. HNSW gives
-- ~logarithmic search with very high recall; build params default (m=16,
-- ef_construction=64) are right for single-user corpora. Runtime recall/speed
-- is tunable per-session with `SET hnsw.ef_search` (default 40) — the kernel
-- can raise it when a query needs exhaustive recall. The index coexists with
-- the exact operator: pgvector transparently uses the index for the ORDER BY
-- and still returns true-distance-ordered rows.

CREATE INDEX memory_embeddings_hnsw_idx
  ON memory_embeddings USING hnsw (embedding vector_cosine_ops);
