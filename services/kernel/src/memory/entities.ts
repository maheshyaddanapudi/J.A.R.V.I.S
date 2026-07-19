import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { Vault } from "../crypto/vault.js";
import type { SemanticMemory } from "./semantic.js";
import type { EpistemicStatus, Sensitivity } from "./memory.js";

/**
 * Semantic knowledge store (Phase 2 — the "full memory store set"; parity H).
 * Entities (typed nodes: person/project/place/…), facts about them, and relations
 * between them — a knowledge-graph-lite so J.A.R.V.I.S. durably KNOWS ABOUT the
 * user's world, not just the current conversation.
 *
 * Same guarantees as the rest of memory: free-text content (attributes / fact
 * statements / relation notes) is AES-256-GCM encrypted at rest when a vault is
 * present (R-MEM-03); values that still look like secrets are refused (R-MEM-06);
 * every row carries epistemic status + provenance + confidence + sensitivity
 * (R-MEM-05); re-remembering supersedes the old row (kept for history).
 */

/** Content words of a phrase (stop-words dropped) — used to match a correction's
 *  `replaces` hint against a stored fact even when the wording differs. */
const STOP_WORDS = new Set([
  "is", "are", "the", "a", "an", "of", "to", "in", "on", "at", "my", "your", "i", "me",
  "and", "or", "now", "not", "with", "for", "be", "was", "were", "has", "have", "had",
  "that", "this", "it", "as", "by", "from", "he", "she", "they", "we", "you",
]);
function contentWords(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP_WORDS.has(w)));
}

export type EntityKind = string; // person | project | place | org | thing | topic | …

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  attributes: string;
  status: EpistemicStatus;
  provenance: string;
  confidence: number;
  sensitivity: Sensitivity;
  created_at: string;
  updated_at: string;
}

export interface Fact {
  id: string;
  entity_id: string;
  statement: string;
  status: EpistemicStatus;
  provenance: string;
  confidence: number;
  sensitivity: Sensitivity;
  created_at: string;
}

export interface Relation {
  id: string;
  from_entity: string;
  to_entity: string;
  relation: string;
  note: string;
  provenance: string;
}

export interface Recall {
  entity: Entity;
  facts: Fact[];
  relationsOut: (Relation & { toName: string; toKind: string })[];
  relationsIn: (Relation & { fromName: string; fromKind: string })[];
}

/** A multi-hop neighborhood of the knowledge graph (D-0045). */
export interface GraphNeighborhood {
  nodes: { id: string; name: string; kind: string; depth: number }[];
  edges: { from: string; to: string; fromName: string; toName: string; relation: string; note: string }[];
}

/** A hybrid (vector entry points → graph expansion) recall bundle (D-0045). */
export interface GraphRecall {
  entities: { name: string; kind: string; facts: string[] }[];
  relations: { fromName: string; relation: string; toName: string }[];
  /** how the entry points were found: semantic (embeddings) or lexical fallback */
  mode: "semantic" | "lexical";
}

function assertNotSecret(value: string): void {
  if (redactSecrets(value) !== value) {
    throw new Error(
      "refused: value looks like a secret — store credentials in the secrets vault, not memory (R-MEM-06)",
    );
  }
}

export class EntityMemory {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly vault?: Vault,
    /** optional vector index — enables hybrid graph recall (D-0045); best-effort */
    private readonly semantic?: SemanticMemory,
  ) {}

  private enc(plaintext: string): string {
    return this.vault && plaintext ? this.vault.encrypt(plaintext) : plaintext;
  }
  private dec(stored: string): string {
    return this.vault && stored.startsWith("v1.gcm.") ? this.vault.decrypt(stored) : stored;
  }

  /** Create or supersede an entity by (name, kind). */
  async rememberEntity(input: {
    kind: string;
    name: string;
    attributes?: string;
    provenance: string;
    status?: EpistemicStatus;
    confidence?: number;
    sensitivity?: Sensitivity;
  }): Promise<Entity> {
    if (!input.kind.trim() || !input.name.trim()) throw new Error("refused: entity needs a kind and a name");
    if (input.attributes) assertNotSecret(input.attributes);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Supersede any active entity with the same (name, kind), capturing their
      // ids so we can link them FORWARD to the replacement (superseded_by) — the
      // history chain is walkable, not just a dangling 'superseded' status.
      const { rows: superseded } = await client.query<{ id: string }>(
        `UPDATE memory_entities SET status = 'superseded', updated_at = now()
         WHERE lower(name) = lower($1) AND kind = $2 AND status NOT IN ('deleted','superseded')
         RETURNING id`,
        [input.name, input.kind],
      );
      const { rows } = await client.query(
        `INSERT INTO memory_entities (kind, name, attributes, status, provenance, confidence, sensitivity)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, kind, name, attributes, status, provenance, confidence, sensitivity, created_at, updated_at`,
        [
          input.kind,
          input.name,
          this.enc(input.attributes ?? ""),
          input.status ?? "user_statement",
          input.provenance,
          input.confidence ?? 1.0,
          input.sensitivity ?? "personal",
        ],
      );
      if (superseded.length) {
        await client.query(
          `UPDATE memory_entities SET superseded_by = $1 WHERE id = ANY($2::uuid[])`,
          [rows[0].id, superseded.map((r) => r.id)],
        );
      }
      await client.query("COMMIT");
      await this.audit.append({
        actor: "kernel",
        event: "entity_remembered",
        payload: { kind: input.kind, name: input.name, provenance: input.provenance },
      });
      const entity = this.hydrateEntity(rows[0]);
      // Best-effort vector indexing (hybrid graph recall, D-0045) — embedded from
      // the plaintext (never ciphertext); a missing embedder is a no-op.
      if (this.semantic) {
        void this.semantic.index("entity", entity.id, [input.name, input.kind, input.attributes ?? ""].join(". "));
      }
      return entity;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Look up an active entity by name (case-insensitive), optionally by kind. */
  private async findEntity(name: string, kind?: string): Promise<Entity | null> {
    const { rows } = await this.pool.query(
      `SELECT id, kind, name, attributes, status, provenance, confidence, sensitivity, created_at, updated_at
       FROM memory_entities
       WHERE lower(name) = lower($1) AND status NOT IN ('deleted','superseded')
         ${kind ? "AND kind = $2" : ""}
       ORDER BY updated_at DESC LIMIT 1`,
      kind ? [name, kind] : [name],
    );
    return rows[0] ? this.hydrateEntity(rows[0]) : null;
  }

  /** Resolve an entity by name, creating a bare one if it does not exist. */
  private async ensureEntity(name: string, kind: string, provenance: string): Promise<Entity> {
    return (await this.findEntity(name)) ?? (await this.rememberEntity({ kind, name, provenance }));
  }

  async rememberFact(input: {
    entityName: string;
    entityKind?: string;
    statement: string;
    provenance: string;
    status?: EpistemicStatus;
    confidence?: number;
    sensitivity?: Sensitivity;
  }): Promise<Fact> {
    if (!input.statement.trim()) throw new Error("refused: fact needs a statement");
    assertNotSecret(input.statement);
    const entity = await this.ensureEntity(input.entityName, input.entityKind ?? "thing", input.provenance);
    const { rows } = await this.pool.query(
      `INSERT INTO memory_facts (entity_id, statement, status, provenance, confidence, sensitivity)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, entity_id, statement, status, provenance, confidence, sensitivity, created_at`,
      [
        entity.id,
        this.enc(input.statement),
        input.status ?? "user_statement",
        input.provenance,
        input.confidence ?? 1.0,
        input.sensitivity ?? "personal",
      ],
    );
    await this.audit.append({
      actor: "kernel",
      event: "fact_remembered",
      payload: { entity: entity.name, provenance: input.provenance },
    });
    const fact = this.hydrateFact(rows[0]);
    // Best-effort vector indexing of the fact statement (plaintext, pre-encryption).
    if (this.semantic) {
      void this.semantic.index("fact", fact.id, `${entity.name}: ${input.statement}`);
    }
    return fact;
  }

  /**
   * Correct a FACT about an entity: supersede the prior statement(s) — kept as
   * history with `superseded_by` pointing at the replacement — and record the new
   * one. This is the fact-level analogue of entity re-remember (D-0060 gap fix):
   * before this, a contradicting fact just piled up alongside the stale one.
   * `replaces` (a substring of the old statement, case-insensitive) targets which
   * fact(s) to supersede; if omitted, the single most-recent active fact is
   * superseded. If nothing matches, the new fact is still recorded (reported).
   */
  async correctFact(input: {
    entityName: string;
    newStatement: string;
    /** PRECISE target: the id of the fact to supersede (from a prior recall —
     *  the read-before-write path; always preferred over text matching). */
    factId?: string;
    replaces?: string;
    entityKind?: string;
    provenance: string;
  }): Promise<{ fact: Fact; supersededCount: number }> {
    if (!input.newStatement.trim()) throw new Error("refused: a correction needs a new statement");
    assertNotSecret(input.newStatement);
    const entity = await this.ensureEntity(input.entityName, input.entityKind ?? "thing", input.provenance);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: active } = await client.query<{ id: string; statement: string }>(
        `SELECT id, statement FROM memory_facts
         WHERE entity_id = $1 AND status NOT IN ('deleted','superseded')
         ORDER BY created_at DESC`,
        [entity.id],
      );
      let targets: string[];
      if (input.factId) {
        // Explicit id from a prior recall — exact, no guessing. Must belong to
        // this entity and still be active, else the correction is refused
        // (an id typo must not silently supersede nothing or the wrong thing).
        if (!active.some((r) => r.id === input.factId)) {
          throw new Error(`no active fact ${input.factId} on '${entity.name}' — recall the entity and use a current fact id`);
        }
        targets = [input.factId];
      } else if (input.replaces && input.replaces.trim()) {
        const needle = input.replaces.trim().toLowerCase();
        // 1) exact substring match (precise).
        targets = active.filter((r) => this.dec(r.statement).toLowerCase().includes(needle)).map((r) => r.id);
        // 2) fallback: the active fact sharing the most CONTENT words with
        //    `replaces` (stop-words dropped, so "likes coffee" vs "likes tea"
        //    does NOT false-match, but "6am run" vs "runs at 6am" does). Requires
        //    ≥1 shared content word; otherwise the new statement is just added.
        if (!targets.length) {
          const want = contentWords(needle);
          let best: { id: string; shared: number } | null = null;
          for (const r of active) {
            const have = contentWords(this.dec(r.statement));
            let shared = 0;
            for (const w of want) if (have.has(w)) shared++;
            if (shared > (best?.shared ?? 0)) best = { id: r.id, shared };
          }
          if (best && best.shared >= 1) targets = [best.id];
        }
      } else {
        targets = active.length ? [active[0]!.id] : []; // no target named → most recent active fact
      }
      const { rows: ins } = await client.query(
        `INSERT INTO memory_facts (entity_id, statement, status, provenance, confidence, sensitivity)
         VALUES ($1,$2,'user_statement',$3,1.0,'personal')
         RETURNING id, entity_id, statement, status, provenance, confidence, sensitivity, created_at`,
        [entity.id, this.enc(input.newStatement), input.provenance],
      );
      const newId = ins[0]!.id as string;
      if (targets.length) {
        await client.query(
          `UPDATE memory_facts SET status = 'superseded', superseded_by = $1 WHERE id = ANY($2::uuid[])`,
          [newId, targets],
        );
      }
      await client.query("COMMIT");
      await this.audit.append({
        actor: "kernel",
        event: "fact_corrected",
        payload: { entity: entity.name, superseded: targets.length, provenance: input.provenance },
      });
      // Vector index: drop the superseded facts, index the replacement (best-effort).
      if (this.semantic) {
        for (const id of targets) void this.semantic.remove("fact", id);
        void this.semantic.index("fact", newId, `${entity.name}: ${input.newStatement}`);
      }
      return { fact: this.hydrateFact(ins[0]), supersededCount: targets.length };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async relate(input: {
    fromName: string;
    toName: string;
    relation: string;
    note?: string;
    provenance: string;
    kind?: string;
  }): Promise<Relation> {
    if (!input.relation.trim()) throw new Error("refused: relation needs a type");
    if (input.note) assertNotSecret(input.note);
    const from = await this.ensureEntity(input.fromName, input.kind ?? "thing", input.provenance);
    const to = await this.ensureEntity(input.toName, input.kind ?? "thing", input.provenance);
    const { rows } = await this.pool.query(
      `INSERT INTO memory_relations (from_entity, to_entity, relation, note, provenance)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (from_entity, to_entity, relation)
       DO UPDATE SET note = EXCLUDED.note, provenance = EXCLUDED.provenance
       RETURNING id, from_entity, to_entity, relation, note, provenance`,
      [from.id, to.id, input.relation, this.enc(input.note ?? ""), input.provenance],
    );
    await this.audit.append({
      actor: "kernel",
      event: "relation_remembered",
      payload: { from: from.name, to: to.name, relation: input.relation },
    });
    return this.hydrateRelation(rows[0]);
  }

  /** Everything J.A.R.V.I.S. knows about a named entity. */
  async recall(name: string): Promise<Recall | null> {
    const entity = await this.findEntity(name);
    if (!entity) return null;
    await this.pool.query("UPDATE memory_entities SET last_used_at = now() WHERE id = $1", [entity.id]);
    const facts = await this.pool.query(
      `SELECT id, entity_id, statement, status, provenance, confidence, sensitivity, created_at
       FROM memory_facts WHERE entity_id = $1 AND status NOT IN ('deleted','superseded')
       ORDER BY confidence DESC, created_at DESC`,
      [entity.id],
    );
    const out = await this.pool.query(
      `SELECT r.id, r.from_entity, r.to_entity, r.relation, r.note, r.provenance, e.name AS to_name, e.kind AS to_kind
       FROM memory_relations r JOIN memory_entities e ON e.id = r.to_entity WHERE r.from_entity = $1`,
      [entity.id],
    );
    const inc = await this.pool.query(
      `SELECT r.id, r.from_entity, r.to_entity, r.relation, r.note, r.provenance, e.name AS from_name, e.kind AS from_kind
       FROM memory_relations r JOIN memory_entities e ON e.id = r.from_entity WHERE r.to_entity = $1`,
      [entity.id],
    );
    return {
      entity,
      facts: facts.rows.map((f) => this.hydrateFact(f)),
      relationsOut: out.rows.map((r) => ({ ...this.hydrateRelation(r), toName: r.to_name, toKind: r.to_kind })),
      relationsIn: inc.rows.map((r) => ({ ...this.hydrateRelation(r), fromName: r.from_name, fromKind: r.from_kind })),
    };
  }

  async listEntities(kind?: string): Promise<Entity[]> {
    const { rows } = await this.pool.query(
      `SELECT id, kind, name, attributes, status, provenance, confidence, sensitivity, created_at, updated_at
       FROM memory_entities WHERE status NOT IN ('deleted','superseded') ${kind ? "AND kind = $1" : ""}
       ORDER BY updated_at DESC LIMIT 200`,
      kind ? [kind] : [],
    );
    return rows.map((r) => this.hydrateEntity(r));
  }

  /**
   * Recently-referenced entities for the conversation context — NON-SENSITIVE
   * only (public/personal entity + facts; private/secret excluded), so nothing
   * sensitive is injected into every conversation. Each entity carries up to two
   * top facts. Ordered by last recall, then recency.
   */
  async recentForContext(limit = 5): Promise<{ name: string; kind: string; facts: string[] }[]> {
    const { rows: ents } = await this.pool.query<{ id: string; name: string; kind: string }>(
      `SELECT id, name, kind FROM memory_entities
       WHERE status NOT IN ('deleted','superseded') AND sensitivity IN ('public','personal')
       ORDER BY last_used_at DESC NULLS LAST, updated_at DESC LIMIT $1`,
      [Math.max(1, Math.min(limit, 20))],
    );
    const out: { name: string; kind: string; facts: string[] }[] = [];
    for (const e of ents) {
      const { rows: facts } = await this.pool.query<{ statement: string }>(
        `SELECT statement FROM memory_facts
         WHERE entity_id = $1 AND status NOT IN ('deleted','superseded') AND sensitivity IN ('public','personal')
         ORDER BY confidence DESC, created_at DESC LIMIT 2`,
        [e.id],
      );
      out.push({ name: e.name, kind: e.kind, facts: facts.map((f) => this.dec(f.statement)) });
    }
    return out;
  }

  /** Soft-delete an entity (excluded from recall immediately). */
  async forgetEntity(name: string): Promise<boolean> {
    // capture ids first so the vector index can be scrubbed too (forget = gone)
    const { rows: ids } = await this.pool.query<{ id: string }>(
      `SELECT id FROM memory_entities WHERE lower(name) = lower($1) AND status NOT IN ('deleted','superseded')`,
      [name],
    );
    const { rowCount } = await this.pool.query(
      `UPDATE memory_entities SET status = 'deleted', updated_at = now()
       WHERE lower(name) = lower($1) AND status NOT IN ('deleted','superseded')`,
      [name],
    );
    if (rowCount) {
      await this.audit.append({ actor: "kernel", event: "entity_forgotten", payload: { name } });
      if (this.semantic) {
        for (const { id } of ids) {
          void this.semantic.remove("entity", id);
          const { rows: facts } = await this.pool.query<{ id: string }>(
            `SELECT id FROM memory_facts WHERE entity_id = $1`,
            [id],
          );
          for (const f of facts) void this.semantic.remove("fact", f.id);
        }
      }
    }
    return (rowCount ?? 0) > 0;
  }

  /** Soft-delete ONE fact by id (from a prior recall) — for "that's no longer
   *  true" without dropping the whole entity or replacing the fact. */
  async forgetFact(factId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE memory_facts SET status = 'deleted'
       WHERE id = $1 AND status NOT IN ('deleted','superseded')`,
      [factId],
    );
    if (rowCount) {
      await this.audit.append({ actor: "kernel", event: "fact_forgotten", payload: { factId } });
      if (this.semantic) void this.semantic.remove("fact", factId);
    }
    return (rowCount ?? 0) > 0;
  }

  /**
   * Multi-hop, undirected traversal of the knowledge graph from a named entity
   * (D-0045 — the associative "what's connected to what's connected to X" recall
   * that vector similarity can't answer). Cycle-safe recursive CTE; depth ≤ 3;
   * bounded node count. Read-only.
   */
  async traverse(name: string, depth = 2): Promise<GraphNeighborhood | null> {
    const d = Math.max(1, Math.min(depth, 3));
    const { rows: nodes } = await this.pool.query<{ id: string; name: string; kind: string; depth: number }>(
      `WITH RECURSIVE walk AS (
         SELECT e.id, 0 AS depth, ARRAY[e.id] AS path
         FROM memory_entities e
         WHERE lower(e.name) = lower($1) AND e.status NOT IN ('deleted','superseded')
         UNION ALL
         SELECT nxt.id, w.depth + 1, w.path || nxt.id
         FROM walk w
         JOIN memory_relations r ON r.from_entity = w.id OR r.to_entity = w.id
         JOIN memory_entities nxt
           ON nxt.id = CASE WHEN r.from_entity = w.id THEN r.to_entity ELSE r.from_entity END
         WHERE w.depth < $2
           AND nxt.status NOT IN ('deleted','superseded')
           AND NOT nxt.id = ANY(w.path)
       )
       SELECT DISTINCT ON (w.id) w.id, e.name, e.kind, w.depth
       FROM walk w JOIN memory_entities e ON e.id = w.id
       ORDER BY w.id, w.depth ASC
       LIMIT 100`,
      [name, d],
    );
    if (nodes.length === 0) return null;
    const ids = nodes.map((n) => n.id);
    const { rows: edges } = await this.pool.query<{
      from_entity: string; to_entity: string; relation: string; note: string; from_name: string; to_name: string;
    }>(
      `SELECT r.from_entity, r.to_entity, r.relation, r.note, ef.name AS from_name, et.name AS to_name
       FROM memory_relations r
       JOIN memory_entities ef ON ef.id = r.from_entity
       JOIN memory_entities et ON et.id = r.to_entity
       WHERE r.from_entity = ANY($1) AND r.to_entity = ANY($1)`,
      [ids],
    );
    return {
      nodes: nodes.sort((a, b) => a.depth - b.depth),
      edges: edges.map((e) => ({
        from: e.from_entity, to: e.to_entity,
        fromName: e.from_name, toName: e.to_name,
        relation: e.relation, note: this.dec(e.note ?? ""),
      })),
    };
  }

  /**
   * Hybrid graph recall (GraphRAG-lite, D-0045): vector search finds ENTRY-POINT
   * entities/facts by meaning, then the graph EXPANDS one hop to pull in connected
   * context — similar + connected, which neither mechanism gives alone. Falls back
   * to lexical name/fact matching when no embedder is available (never a mock).
   */
  async recallGraph(query: string, limit = 5): Promise<GraphRecall> {
    const seedIds = new Set<string>();
    let mode: GraphRecall["mode"] = "semantic";
    if (this.semantic) {
      const hits = await this.semantic.search(query, { kinds: ["entity", "fact"], limit: limit * 2 });
      for (const h of hits) {
        if (h.sourceKind === "entity") seedIds.add(h.sourceId);
        else if (h.sourceKind === "fact") {
          const { rows } = await this.pool.query<{ entity_id: string }>(
            `SELECT entity_id FROM memory_facts WHERE id = $1`,
            [h.sourceId],
          );
          if (rows[0]) seedIds.add(rows[0].entity_id);
        }
      }
    }
    if (seedIds.size === 0) {
      // lexical fallback: entity names appearing in the query, or query terms in names
      mode = "lexical";
      const { rows } = await this.pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM memory_entities WHERE status NOT IN ('deleted','superseded') LIMIT 200`,
      );
      const q = query.toLowerCase();
      for (const r of rows) {
        const n = r.name.toLowerCase();
        if (q.includes(n) || n.split(/\s+/).some((w) => w.length > 3 && q.includes(w))) seedIds.add(r.id);
      }
    }
    const seeds = [...seedIds].slice(0, limit);
    const entities: GraphRecall["entities"] = [];
    const relations: GraphRecall["relations"] = [];
    const included = new Set<string>();
    const addEntity = async (id: string) => {
      if (included.has(id) || included.size >= limit * 3) return;
      const { rows } = await this.pool.query<{ id: string; name: string; kind: string }>(
        `SELECT id, name, kind FROM memory_entities WHERE id = $1 AND status NOT IN ('deleted','superseded')`,
        [id],
      );
      if (!rows[0]) return;
      included.add(id);
      const { rows: facts } = await this.pool.query<{ statement: string }>(
        `SELECT statement FROM memory_facts
         WHERE entity_id = $1 AND status NOT IN ('deleted','superseded')
         ORDER BY confidence DESC, created_at DESC LIMIT 3`,
        [id],
      );
      entities.push({ name: rows[0].name, kind: rows[0].kind, facts: facts.map((f) => this.dec(f.statement)) });
    };
    for (const id of seeds) {
      await addEntity(id);
      // one-hop expansion: pull in connected entities + the connecting edges
      const { rows: rels } = await this.pool.query<{
        from_entity: string; to_entity: string; relation: string; from_name: string; to_name: string;
      }>(
        `SELECT r.from_entity, r.to_entity, r.relation, ef.name AS from_name, et.name AS to_name
         FROM memory_relations r
         JOIN memory_entities ef ON ef.id = r.from_entity AND ef.status NOT IN ('deleted','superseded')
         JOIN memory_entities et ON et.id = r.to_entity AND et.status NOT IN ('deleted','superseded')
         WHERE r.from_entity = $1 OR r.to_entity = $1
         LIMIT 10`,
        [id],
      );
      for (const r of rels) {
        relations.push({ fromName: r.from_name, relation: r.relation, toName: r.to_name });
        await addEntity(r.from_entity === id ? r.to_entity : r.from_entity);
      }
    }
    // dedupe relations (same edge reachable from both endpoints)
    const seen = new Set<string>();
    const uniqueRelations = relations.filter((r) => {
      const k = `${r.fromName}|${r.relation}|${r.toName}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { entities, relations: uniqueRelations, mode };
  }

  private hydrateEntity(r: Record<string, unknown>): Entity {
    return { ...(r as unknown as Entity), attributes: this.dec(String(r.attributes ?? "")) };
  }
  private hydrateFact(r: Record<string, unknown>): Fact {
    return { ...(r as unknown as Fact), statement: this.dec(String(r.statement ?? "")) };
  }
  private hydrateRelation(r: Record<string, unknown>): Relation {
    return { ...(r as unknown as Relation), note: this.dec(String(r.note ?? "")) };
  }
}
