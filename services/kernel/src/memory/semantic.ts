import type pg from "pg";

/**
 * Semantic (vector) recall over memory — the remaining piece of "perfect recall"
 * (parity H1). Turns any memory item's text into an embedding (via the model
 * gateway's embeddings role) and indexes it in pgvector (migration 0012), so
 * recall can rank by MEANING rather than exact name / substring.
 *
 * HONEST DEGRADATION (never a mock): every method is best-effort. If no embedding
 * provider is available (offline with no local embedder, or none configured), an
 * index attempt is a no-op returning `false` and a search returns `[]` — the caller
 * then falls back to the existing REAL lexical recall. Nothing is faked; semantic
 * ranking simply activates when an embedder is present (nomic-embed-text on the
 * Mac, D-0012). The retrieval MECHANICS (store vector → cosine KNN) are real and
 * exercised in-container against a live embeddings endpoint.
 */

/** Embeds texts → one vector per text. Thin adapter over the gateway router. */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export type SemanticSource = "episode" | "fact" | "entity" | "conversation";

export interface SemanticHit {
  sourceKind: SemanticSource;
  sourceId: string;
  distance: number; // cosine distance (0 = identical); lower is closer
}

const DIM = 768; // nomic-embed-text; must match memory_embeddings.embedding vector(768)

function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

export class SemanticMemory {
  private readonly model: string;
  private readonly dim: number;

  constructor(
    private readonly pool: pg.Pool,
    private readonly embed: EmbedFn,
    opts?: { model?: string; dim?: number },
  ) {
    this.model = opts?.model ?? "nomic-embed-text";
    this.dim = opts?.dim ?? DIM;
  }

  /** Is an embedding provider actually reachable right now? (best-effort probe) */
  async available(): Promise<boolean> {
    try {
      const [v] = await this.embed(["ping"]);
      return Array.isArray(v) && v.length === this.dim;
    } catch {
      return false;
    }
  }

  /**
   * Index (or re-index) one memory item. Returns true if a vector was stored,
   * false if embedding was unavailable or the dimension didn't match (skipped,
   * never throws — a write must not fail because the embedder is down).
   */
  async index(sourceKind: SemanticSource, sourceId: string, text: string): Promise<boolean> {
    if (!text.trim()) return false;
    let vec: number[] | undefined;
    try {
      [vec] = await this.embed([text]);
    } catch {
      return false; // no embedder → leave un-indexed (lexical recall still works)
    }
    if (!vec || vec.length !== this.dim) return false;
    try {
      await this.pool.query(
        `INSERT INTO memory_embeddings (source_kind, source_id, model, dim, embedding)
         VALUES ($1,$2,$3,$4,$5::vector)
         ON CONFLICT (source_kind, source_id, model)
         DO UPDATE SET embedding = EXCLUDED.embedding, dim = EXCLUDED.dim, created_at = now()`,
        [sourceKind, sourceId, this.model, vec.length, toVectorLiteral(vec)],
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Remove an item's embedding (e.g. when it is forgotten). Best-effort. */
  async remove(sourceKind: SemanticSource, sourceId: string): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM memory_embeddings WHERE source_kind = $1 AND source_id = $2`,
        [sourceKind, sourceId],
      );
    } catch {
      /* best-effort */
    }
  }

  /**
   * Nearest items to `query` by cosine distance. Returns [] if no embedder is
   * available or nothing is indexed — the caller falls back to lexical recall.
   */
  async search(
    query: string,
    opts: { kinds?: SemanticSource[]; limit?: number } = {},
  ): Promise<SemanticHit[]> {
    if (!query.trim()) return [];
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 100));
    let vec: number[] | undefined;
    try {
      [vec] = await this.embed([query]);
    } catch {
      return [];
    }
    if (!vec || vec.length !== this.dim) return [];
    const params: unknown[] = [toVectorLiteral(vec), this.model];
    let kindClause = "";
    if (opts.kinds && opts.kinds.length) {
      params.push(opts.kinds);
      kindClause = `AND source_kind = ANY($${params.length})`;
    }
    params.push(limit);
    try {
      const { rows } = await this.pool.query<{ source_kind: SemanticSource; source_id: string; distance: number }>(
        `SELECT source_kind, source_id, (embedding <=> $1::vector) AS distance
         FROM memory_embeddings
         WHERE model = $2 ${kindClause}
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $${params.length}`,
        params,
      );
      return rows.map((r) => ({ sourceKind: r.source_kind, sourceId: r.source_id, distance: Number(r.distance) }));
    } catch {
      return [];
    }
  }

  /** How many items are indexed (for status / "is semantic recall live"). */
  async count(): Promise<number> {
    try {
      const { rows } = await this.pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM memory_embeddings WHERE model = $1`,
        [this.model],
      );
      return Number(rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }
}
