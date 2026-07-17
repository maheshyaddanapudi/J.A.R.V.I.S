import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { Vault } from "../crypto/vault.js";
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
      // supersede any active entity with the same (name, kind)
      await client.query(
        `UPDATE memory_entities SET status = 'superseded', updated_at = now()
         WHERE lower(name) = lower($1) AND kind = $2 AND status NOT IN ('deleted','superseded')`,
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
      await client.query("COMMIT");
      await this.audit.append({
        actor: "kernel",
        event: "entity_remembered",
        payload: { kind: input.kind, name: input.name, provenance: input.provenance },
      });
      return this.hydrateEntity(rows[0]);
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
    return this.hydrateFact(rows[0]);
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

  /** Soft-delete an entity (excluded from recall immediately). */
  async forgetEntity(name: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE memory_entities SET status = 'deleted', updated_at = now()
       WHERE lower(name) = lower($1) AND status NOT IN ('deleted','superseded')`,
      [name],
    );
    if (rowCount) await this.audit.append({ actor: "kernel", event: "entity_forgotten", payload: { name } });
    return (rowCount ?? 0) > 0;
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
