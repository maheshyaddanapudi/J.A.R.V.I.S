import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { Vault } from "../crypto/vault.js";
import type { SemanticMemory } from "./semantic.js";
import type { EpistemicStatus, Sensitivity } from "./memory.js";

/**
 * Episodic memory (Phase 2 — the "full memory store set"; parity H). A durable,
 * recallable TIMELINE of notable events: what happened, when, and why it mattered.
 * J.A.R.V.I.S. draws on it in conversation — "earlier today you…", "the last time
 * you edited that file…" — and it feeds the situational-context block.
 *
 * This is NOT the audit log. The audit log (src/core/audit.ts) is a security
 * record: immutable, append-only, hash-chained, never forgettable. Episodic
 * memory is a SEMANTIC memory: importance-ranked, forgettable (R-MEM-04), and
 * encrypted at rest (R-MEM-03). It also complements the semantic store
 * (entities/facts = what J.A.R.V.I.S. KNOWS ABOUT the world; episodes = what
 * HAPPENED over time).
 *
 * Free-text content (summary / detail) is AES-256-GCM encrypted at rest when a
 * vault is present, and detected secrets are redacted before write (R-MEM-06) —
 * because episodes are frequently auto-recorded from activity, a secret-shaped
 * value is masked rather than rejected (matching conversation memory), so an
 * event log can never break the loop. `tags` stay plaintext (categorical labels)
 * so they remain SQL-searchable; free-text `query` matching runs after decryption
 * (ciphertext is opaque to SQL by design, same tradeoff as facts).
 */

export type EpisodeKind = "observation" | "action" | "decision" | "note" | "milestone";
const KINDS: EpisodeKind[] = ["observation", "action", "decision", "note", "milestone"];

export interface Episode {
  id: string;
  occurred_at: string;
  kind: EpisodeKind;
  summary: string;
  detail: string;
  entity_id: string | null;
  entity_name: string | null;
  importance: number;
  tags: string[];
  status: EpistemicStatus;
  provenance: string;
  sensitivity: Sensitivity;
  created_at: string;
}

export interface RecallOptions {
  /** free-text substring match over decrypted summary + detail (case-insensitive) */
  query?: string;
  kind?: EpisodeKind;
  tag?: string;
  /** only episodes at or after this instant */
  since?: Date;
  /** only episodes linked to this named entity */
  entityName?: string;
  limit?: number;
}

function normalizeKind(kind?: string): EpisodeKind {
  return kind && (KINDS as string[]).includes(kind) ? (kind as EpisodeKind) : "note";
}

export class EpisodicMemory {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly vault?: Vault,
    /** optional vector index — enables recall-by-meaning (H1); best-effort */
    private readonly semantic?: SemanticMemory,
  ) {}

  private enc(plaintext: string): string {
    return this.vault && plaintext ? this.vault.encrypt(plaintext) : plaintext;
  }
  private dec(stored: string): string {
    return this.vault && stored.startsWith("v1.gcm.") ? this.vault.decrypt(stored) : stored;
  }

  /** Resolve a named active entity to its id (never creates one — episodes only link). */
  private async resolveEntity(name: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM memory_entities
       WHERE lower(name) = lower($1) AND status NOT IN ('deleted','superseded')
       ORDER BY updated_at DESC LIMIT 1`,
      [name],
    );
    return rows[0]?.id ?? null;
  }

  /** Record a notable event on the timeline. */
  async record(input: {
    summary: string;
    kind?: EpisodeKind;
    detail?: string;
    entityName?: string;
    importance?: number;
    tags?: string[];
    sensitivity?: Sensitivity;
    status?: EpistemicStatus;
    provenance: string;
    occurredAt?: Date;
  }): Promise<Episode> {
    if (!input.summary.trim()) throw new Error("refused: an episode needs a summary");
    const kind = normalizeKind(input.kind);
    const importance = Math.max(0, Math.min(1, input.importance ?? 0.5));
    const entityId = input.entityName ? await this.resolveEntity(input.entityName) : null;
    // Detected secrets are masked (not rejected) so an auto-recorded event log
    // can never throw inside the loop (R-MEM-06) — same policy as conversation.
    const summary = redactSecrets(input.summary.trim());
    const detail = input.detail ? redactSecrets(input.detail) : "";
    const tags = (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);

    const { rows } = await this.pool.query(
      `INSERT INTO memory_episodes
         (occurred_at, kind, summary, detail, entity_id, importance, tags, status, provenance, sensitivity)
       VALUES (COALESCE($1, now()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, occurred_at, kind, summary, detail, entity_id, importance, tags, status, provenance, sensitivity, created_at`,
      [
        input.occurredAt ? input.occurredAt.toISOString() : null,
        kind,
        this.enc(summary),
        this.enc(detail),
        entityId,
        importance,
        tags,
        input.status ?? "user_statement",
        input.provenance,
        input.sensitivity ?? "personal",
      ],
    );
    await this.audit.append({
      actor: "kernel",
      event: "episode_recorded",
      payload: { kind, provenance: input.provenance, importance },
    });
    const episode = this.hydrate(rows[0]);
    // Best-effort semantic indexing (recall-by-meaning, H1). Uses the redacted
    // plaintext (not the ciphertext); a missing embedder is a no-op — the episode
    // is still fully recallable lexically. Never blocks the write.
    if (this.semantic) {
      void this.semantic.index("episode", episode.id, [summary, detail].filter(Boolean).join(". "));
    }
    return episode;
  }

  /**
   * Recall the timeline. SQL narrows by the indexable filters (kind / tag / since
   * / linked entity); the free-text `query` is applied after decryption. Results
   * are newest-first, bounded.
   */
  async recall(opts: RecallOptions = {}): Promise<Episode[]> {
    const limit = Math.max(1, Math.min(opts.limit ?? 20, 200));
    const where: string[] = ["e.status <> 'deleted'"];
    const params: unknown[] = [];
    if (opts.kind) {
      params.push(opts.kind);
      where.push(`e.kind = $${params.length}`);
    }
    if (opts.tag) {
      params.push(opts.tag.toLowerCase());
      where.push(`$${params.length} = ANY(e.tags)`);
    }
    if (opts.since) {
      params.push(opts.since.toISOString());
      where.push(`e.occurred_at >= $${params.length}`);
    }
    if (opts.entityName) {
      const id = await this.resolveEntity(opts.entityName);
      if (!id) return [];
      params.push(id);
      where.push(`e.entity_id = $${params.length}`);
    }
    // Over-fetch when a free-text query will filter post-decryption, so the final
    // slice still returns up to `limit` matches.
    const fetch = opts.query ? Math.min(limit * 8, 200) : limit;
    params.push(fetch);
    const { rows } = await this.pool.query(
      `SELECT e.id, e.occurred_at, e.kind, e.summary, e.detail, e.entity_id,
              e.importance, e.tags, e.status, e.provenance, e.sensitivity, e.created_at,
              ent.name AS entity_name
       FROM memory_episodes e
       LEFT JOIN memory_entities ent ON ent.id = e.entity_id
       WHERE ${where.join(" AND ")}
       ORDER BY e.occurred_at DESC
       LIMIT $${params.length}`,
      params,
    );
    let out = rows.map((r) => this.hydrate(r));
    if (opts.query) {
      const q = opts.query.toLowerCase();
      out = out.filter((e) => `${e.summary} ${e.detail}`.toLowerCase().includes(q));
    }
    return out.slice(0, limit);
  }

  /** The most recent events (newest first). */
  async timeline(limit = 20): Promise<Episode[]> {
    return this.recall({ limit });
  }

  /**
   * Recent NON-SENSITIVE episodes for the situational-context block — public /
   * personal only (private/secret excluded), so nothing sensitive is injected
   * into every conversation. Decrypted summary + when + kind, importance-then-
   * recency ordered.
   */
  async recentForContext(limit = 4): Promise<{ when: string; kind: string; summary: string }[]> {
    const { rows } = await this.pool.query<{ occurred_at: string; kind: string; summary: string }>(
      `SELECT occurred_at::text, kind, summary FROM memory_episodes
       WHERE status <> 'deleted' AND sensitivity IN ('public','personal')
       ORDER BY importance DESC, occurred_at DESC LIMIT $1`,
      [Math.max(1, Math.min(limit, 12))],
    );
    return rows.map((r) => ({ when: r.occurred_at, kind: r.kind, summary: this.dec(r.summary) }));
  }

  /** Soft-delete an episode — excluded from every read immediately (R-MEM-04). */
  async forget(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE memory_episodes SET status = 'deleted' WHERE id = $1 AND status <> 'deleted'`,
      [id],
    );
    if (rowCount) {
      await this.audit.append({ actor: "user", event: "episode_forgotten", payload: { id } });
      if (this.semantic) void this.semantic.remove("episode", id); // drop from the vector index too
    }
    return (rowCount ?? 0) > 0;
  }

  /**
   * Recall by MEANING (H1). Embeds the query and returns the nearest episodes by
   * cosine distance. Falls back to lexical `recall({query})` when no embedder is
   * available or nothing is indexed yet — so this is always at least as good as
   * substring recall, and better when an embedding model is present.
   */
  async semanticRecall(query: string, limit = 10): Promise<Episode[]> {
    if (!this.semantic) return this.recall({ query, limit });
    const hits = await this.semantic.search(query, { kinds: ["episode"], limit });
    if (hits.length === 0) return this.recall({ query, limit }); // no embedder / empty index → lexical
    const ids = hits.map((h) => h.sourceId);
    const { rows } = await this.pool.query(
      `SELECT e.id, e.occurred_at, e.kind, e.summary, e.detail, e.entity_id,
              e.importance, e.tags, e.status, e.provenance, e.sensitivity, e.created_at,
              ent.name AS entity_name
       FROM memory_episodes e
       LEFT JOIN memory_entities ent ON ent.id = e.entity_id
       WHERE e.id = ANY($1) AND e.status <> 'deleted'`,
      [ids],
    );
    const byId = new Map(rows.map((r) => [String(r.id), this.hydrate(r)]));
    // preserve nearest-first order from the vector search; drop any now-deleted
    return ids.map((id) => byId.get(id)).filter((e): e is Episode => Boolean(e));
  }

  private hydrate(r: Record<string, unknown>): Episode {
    return {
      ...(r as unknown as Episode),
      summary: this.dec(String(r.summary ?? "")),
      detail: this.dec(String(r.detail ?? "")),
      entity_name: (r.entity_name as string | null) ?? null,
      tags: (r.tags as string[] | null) ?? [],
    };
  }
}
