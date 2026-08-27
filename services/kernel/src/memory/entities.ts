import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { Vault } from "../crypto/vault.js";
import type { SemanticMemory } from "./semantic.js";
import type { EpistemicStatus, Sensitivity } from "./memory.js";
import type { EntityCandidate, MemoryJudge } from "./judge.js";
import { privacyForSensitivities } from "./judge.js";

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
/** Light suffix-stem so morphology doesn't defeat matching ("reviews" ~
 *  "reviewing" ~ "reviewed" → "review"). Deliberately crude — thresholds and
 *  containment still guard against false merges. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && (w.endsWith("ed") || w.endsWith("es"))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}
function contentWords(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP_WORDS.has(w)).map(stem),
  );
}

/** Loose name-similarity PRE-FILTER for entity resolution (D-0075). Deliberately
 *  permissive — it only selects CANDIDATES for the fast-model judge, which makes
 *  the real same/different decision. Catches substring ('Pepper' ⊂ 'Pepper
 *  Potts'), shared token ('Mark 42' / 'Mark 42 suit'), and near-spelling. */
function nameSimilar(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
  const tx = new Set(x.split(/\s+/).filter((w) => w.length >= 3));
  const ty = new Set(y.split(/\s+/).filter((w) => w.length >= 3));
  for (const w of tx) if (ty.has(w)) return true;
  return diceCoefficient(x, y) >= 0.5;
}
function diceCoefficient(a: string, b: string): number {
  const bigrams = (s: string): Map<string, number> => {
    const t = s.replace(/\s+/g, "");
    const m = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g)!);
  let total = 0;
  for (const c of A.values()) total += c;
  for (const c of B.values()) total += c;
  return (2 * inter) / total;
}
/** Combine an existing entity's attributes with a new mention's, without losing
 *  either (containment-deduped). Old value is also preserved as history on the
 *  superseded row. */
function mergeAttrs(oldA: string, newA: string): string {
  const o = (oldA ?? "").trim();
  const n = (newA ?? "").trim();
  if (!n) return o;
  if (!o) return n;
  if (o.toLowerCase().includes(n.toLowerCase())) return o;
  if (n.toLowerCase().includes(o.toLowerCase())) return n;
  return `${o}; ${n}`;
}
/** Which of two names is the "fuller" (more complete) form — used to pick the
 *  CANONICAL name when a variant is merged into an existing entity (D-0075):
 *  a name that CONTAINS the other wins ('Pepper' ⊂ 'Pepper Potts'); else the one
 *  with more word tokens ('Mark 42' vs 'Mark 42 suit'); else the longer string;
 *  final tie keeps `existing` for stability. */
function preferFuller(existing: string, incoming: string): string {
  const e = existing.trim();
  const i = incoming.trim();
  if (!i) return e;
  if (!e) return i;
  const el = e.toLowerCase();
  const il = i.toLowerCase();
  if (el === il) return e;
  const eInI = il.includes(el);
  const iInE = el.includes(il);
  if (eInI && !iInE) return i;
  if (iInE && !eInI) return e;
  const ew = e.split(/\s+/).length;
  const iw = i.split(/\s+/).length;
  if (iw !== ew) return iw > ew ? i : e;
  if (i.length !== e.length) return i.length > e.length ? i : e;
  return e;
}
/** The fullest name across a set (input + all matched entity names). */
function fullestName(names: string[]): string {
  return names.reduce((best, n) => preferFuller(best, n));
}
/** Cheap gate before spending a model call on consolidation: do any two facts
 *  share a content word at all? If not, there is nothing plausibly duplicated. */
function anyPairShareWord(decoded: { words: Set<string> }[]): boolean {
  for (let i = 0; i < decoded.length; i++) {
    for (let j = i + 1; j < decoded.length; j++) {
      for (const w of decoded[i]!.words) if (decoded[j]!.words.has(w)) return true;
    }
  }
  return false;
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
    /** optional fast-model judge for entity resolution + fact merge (D-0075);
     *  best-effort — every method falls back to deterministic logic on null */
    private readonly judge?: MemoryJudge,
  ) {}

  private enc(plaintext: string): string {
    return this.vault && plaintext ? this.vault.encrypt(plaintext) : plaintext;
  }
  private dec(stored: string): string {
    return this.vault && stored.startsWith("v1.gcm.") ? this.vault.decrypt(stored) : stored;
  }

  /**
   * Create or supersede an entity. Resolution order:
   *   1. EXACT / ALIAS match on (name, kind) → supersede + accrue (the normal path).
   *   2. otherwise, if a fast-model judge is available, ask whether a
   *      similarly-named existing entity is the SAME real-world thing (D-0075):
   *      a positive match accrues this mention to the CANONICAL entity and records
   *      the variant spelling as an alias, so 'Pepper' and 'Pepper Potts' stop
   *      becoming two separate entities. Best-effort — no judge / no similar
   *      candidate / no eligible provider → a plain new entity (previous behavior).
   * Still-active facts + relations migrate forward on every supersede so knowledge
   * accumulates on the live entity (the fragmentation fix); attribute history is
   * kept on the superseded rows.
   */
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

    // Phase A (no transaction): decide the CANONICAL target. Any model call
    // happens HERE — outside the write transaction — so we never hold a row lock
    // across a network round-trip.
    const plan = await this.resolveCanonical(input);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize concurrent writes that target the SAME canonical (name, kind):
      // a transaction-scoped advisory lock fixes the parallel-insert race that
      // could leave duplicate active rows (bug 5). Auto-released on COMMIT/ROLLBACK.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), 0)", [
        `entity:${plan.canonicalName.toLowerCase()}|${plan.canonicalKind}`,
      ]);
      // Supersede exact/alias/canonical matches — re-evaluated UNDER the lock so a
      // row created between phase A and here is still caught. Captured ids are
      // linked FORWARD (superseded_by) and migrated FROM.
      const { rows: superseded } = await client.query<{ id: string }>(
        `UPDATE memory_entities SET status = 'superseded', updated_at = now()
         WHERE kind = $2 AND status NOT IN ('deleted','superseded')
           AND ( lower(name) = lower($1)
                 OR id = ANY($3::uuid[])
                 OR ($4::text[] <> '{}' AND aliases && $4::text[]) )
         RETURNING id`,
        [plan.canonicalName, plan.canonicalKind, plan.supersedeIds, plan.aliases],
      );
      const { rows } = await client.query(
        `INSERT INTO memory_entities (kind, name, attributes, aliases, status, provenance, confidence, sensitivity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, kind, name, attributes, status, provenance, confidence, sensitivity, created_at, updated_at`,
        [
          plan.canonicalKind,
          plan.canonicalName,
          this.enc(plan.attributes),
          plan.aliases,
          input.status ?? "user_statement",
          input.provenance,
          input.confidence ?? 1.0,
          input.sensitivity ?? "personal",
        ],
      );
      if (superseded.length) {
        const oldIds = superseded.map((r) => r.id).filter((id) => id !== rows[0].id);
        if (oldIds.length) {
          await client.query(
            `UPDATE memory_entities SET superseded_by = $1 WHERE id = ANY($2::uuid[])`,
            [rows[0].id, oldIds],
          );
          // MIGRATE knowledge forward (fixes fact fragmentation): re-mentioning an
          // entity supersedes the old row, but its still-active FACTS must move to
          // the new active entity — otherwise recall of the current entity loses
          // everything learned in earlier mentions. History of the ENTITY
          // (attributes) is preserved on the superseded rows; the KNOWLEDGE
          // accumulates on the live entity. Relations are migrated conflict-safely
          // (skip any that would duplicate an existing edge on the new entity).
          await client.query(
            `UPDATE memory_facts SET entity_id = $1
             WHERE entity_id = ANY($2::uuid[]) AND status NOT IN ('deleted','superseded')`,
            [rows[0].id, oldIds],
          );
          await client.query(
            `UPDATE memory_relations r SET from_entity = $1
             WHERE r.from_entity = ANY($2::uuid[])
               AND NOT EXISTS (SELECT 1 FROM memory_relations x
                 WHERE x.from_entity = $1 AND x.to_entity = r.to_entity AND x.relation = r.relation)`,
            [rows[0].id, oldIds],
          );
          await client.query(
            `UPDATE memory_relations r SET to_entity = $1
             WHERE r.to_entity = ANY($2::uuid[])
               AND NOT EXISTS (SELECT 1 FROM memory_relations x
                 WHERE x.to_entity = $1 AND x.from_entity = r.from_entity AND x.relation = r.relation)`,
            [rows[0].id, oldIds],
          );
        }
      }
      await client.query("COMMIT");
      await this.audit.append({
        actor: "kernel",
        event: "entity_remembered",
        payload: {
          kind: plan.canonicalKind,
          name: plan.canonicalName,
          provenance: input.provenance,
          ...(plan.resolvedFrom ? { resolvedFrom: plan.resolvedFrom } : {}),
        },
      });
      const entity = this.hydrateEntity(rows[0]);
      // Best-effort vector indexing (hybrid graph recall, D-0045) — embedded from
      // the plaintext (never ciphertext); a missing embedder is a no-op.
      if (this.semantic) {
        void this.semantic.index("entity", entity.id, [entity.name, entity.kind, plan.attributes].join(". "));
      }
      return entity;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Decide the canonical (name, kind, attributes, aliases) an incoming mention
   *  should accrue to, and which existing rows it supersedes. Phase-A read; any
   *  fast-model resolution happens here (outside the write transaction). */
  private async resolveCanonical(input: {
    kind: string;
    name: string;
    attributes?: string;
    sensitivity?: Sensitivity;
  }): Promise<{
    canonicalName: string;
    canonicalKind: string;
    attributes: string;
    aliases: string[];
    supersedeIds: string[];
    resolvedFrom?: string;
  }> {
    // 1. exact name OR existing alias, same kind
    const { rows: exact } = await this.pool.query<{ id: string; name: string; attributes: string; aliases: string[] }>(
      `SELECT id, name, attributes, aliases FROM memory_entities
       WHERE kind = $2 AND status NOT IN ('deleted','superseded')
         AND ( lower(name) = lower($1) OR aliases && ARRAY[lower($1)]::text[] )
       ORDER BY updated_at DESC`,
      [input.name, input.kind],
    );
    if (exact.length) {
      // Prefer the FULLER name as canonical (D-0075): matching by an ALIAS (e.g.
      // the mention 'Pepper' hitting canonical 'Pepper Potts') must NOT rename the
      // entity to the shorter variant — every non-canonical name becomes an alias.
      const names = [input.name, ...exact.map((r) => r.name)];
      const canonicalName = fullestName(names);
      const canonLower = canonicalName.toLowerCase();
      const aliases = new Set<string>();
      for (const r of exact) for (const a of r.aliases ?? []) aliases.add(a.toLowerCase());
      for (const n of names) if (n.toLowerCase() !== canonLower) aliases.add(n.toLowerCase());
      // Attributes: an EXACT same-name re-mention keeps the D-0038 replace contract
      // (new value wins; old survives as history on the superseded row); an
      // alias/variant hit keeps the canonical entity's attributes and merges in
      // anything new (never loses the fuller entity's notes).
      const exactSameName = input.name.toLowerCase() === canonLower && exact.some((r) => r.name.toLowerCase() === canonLower);
      const canonRow = exact.find((r) => r.name.toLowerCase() === canonLower);
      const attributes = exactSameName
        ? input.attributes ?? ""
        : mergeAttrs(this.dec(canonRow?.attributes ?? exact[0]!.attributes ?? ""), input.attributes ?? "");
      return {
        canonicalName,
        canonicalKind: input.kind,
        attributes,
        aliases: [...aliases],
        supersedeIds: exact.map((r) => r.id),
        ...(canonLower === input.name.toLowerCase() ? {} : { resolvedFrom: input.name }),
      };
    }

    // 2. no same-kind exact/alias hit — ask the judge whether a similarly-named
    //    entity (of ANY kind — the model labels the same thing inconsistently
    //    across sessions) is the same real-world thing (D-0075). Best-effort.
    if (this.judge) {
      const cands = await this.fuzzyCandidates(input.name);
      if (cands.length) {
        const privacy = privacyForSensitivities([input.sensitivity, ...cands.map((c) => c.sensitivity)]);
        const verdict = await this.judge.resolveEntity(
          { name: input.name, kind: input.kind, ...(input.attributes ? { attributes: input.attributes } : {}) },
          cands.map<EntityCandidate>((c) => ({ name: c.name, kind: c.kind, attributes: c.attributes, facts: c.facts })),
          privacy,
        );
        const C = verdict?.sameAs != null ? cands[verdict.sameAs] : undefined;
        if (C) {
          // Prefer the FULLER name as canonical (D-0075): if the incoming mention
          // is the more complete form ('Pepper Potts' resolving to existing
          // 'Pepper'), promote it and demote the shorter one to an alias.
          const canonicalName = preferFuller(C.name, input.name);
          const canonLower = canonicalName.toLowerCase();
          const aliases = new Set<string>((C.aliases ?? []).map((a) => a.toLowerCase()));
          for (const n of [C.name, input.name]) if (n.toLowerCase() !== canonLower) aliases.add(n.toLowerCase());
          return {
            canonicalName,
            canonicalKind: C.kind,
            attributes: mergeAttrs(C.attributes ?? "", input.attributes ?? ""),
            aliases: [...aliases],
            supersedeIds: [C.id],
            resolvedFrom: input.name,
          };
        }
      }
    }

    // 3. brand-new entity
    return {
      canonicalName: input.name,
      canonicalKind: input.kind,
      attributes: input.attributes ?? "",
      aliases: [],
      supersedeIds: [],
    };
  }

  /** Active entities (ANY kind) whose name is lexically similar to `name` — a
   *  loose PRE-FILTER; the judge makes the real same/different call, INCLUDING
   *  cross-kind ('arc reactor' stored as both 'thing' and 'project'). Exact-name
   *  matches of any kind are surfaced first. Each carries a few decrypted facts. */
  private async fuzzyCandidates(
    name: string,
  ): Promise<{ id: string; name: string; kind: string; attributes: string; facts: string[]; aliases: string[]; sensitivity: string }[]> {
    const { rows } = await this.pool.query<{ id: string; name: string; kind: string; attributes: string; aliases: string[]; sensitivity: string }>(
      `SELECT id, name, kind, attributes, aliases, sensitivity FROM memory_entities
       WHERE status NOT IN ('deleted','superseded')
       ORDER BY (lower(name) = lower($1)) DESC, updated_at DESC LIMIT 200`,
      [name],
    );
    const similar = rows
      .filter((r) => nameSimilar(name, r.name) || (r.aliases ?? []).some((a) => nameSimilar(name, a)))
      .slice(0, 8);
    const out: { id: string; name: string; kind: string; attributes: string; facts: string[]; aliases: string[]; sensitivity: string }[] = [];
    for (const r of similar) {
      const { rows: facts } = await this.pool.query<{ statement: string }>(
        `SELECT statement FROM memory_facts WHERE entity_id = $1 AND status NOT IN ('deleted','superseded')
         ORDER BY created_at DESC LIMIT 3`,
        [r.id],
      );
      out.push({
        id: r.id,
        name: r.name,
        kind: r.kind,
        attributes: this.dec(r.attributes ?? ""),
        facts: facts.map((f) => this.dec(f.statement)),
        aliases: r.aliases ?? [],
        sensitivity: r.sensitivity,
      });
    }
    return out;
  }

  /** Look up an active entity by name (case-insensitive) OR by a recorded alias
   *  (D-0075 — so 'Pepper' resolves to canonical 'Pepper Potts'), optionally by
   *  kind. An exact-name match is preferred over an alias-only match. */
  private async findEntity(name: string, kind?: string): Promise<Entity | null> {
    const { rows } = await this.pool.query(
      `SELECT id, kind, name, attributes, status, provenance, confidence, sensitivity, created_at, updated_at
       FROM memory_entities
       WHERE ( lower(name) = lower($1) OR aliases && ARRAY[lower($1)]::text[] )
         AND status NOT IN ('deleted','superseded')
         ${kind ? "AND kind = $2" : ""}
       ORDER BY (lower(name) = lower($1)) DESC, updated_at DESC LIMIT 1`,
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

  /**
   * Quiet-hours memory consolidation (D-0063) — the sleep-time half of "memories
   * update live AND during quiet hours". Live writes stay immediate (every tool
   * call above); this pass runs from the sleep cycle (autonomy tick) and tidies
   * what the day accumulated, like sleep does for a person:
   *  • near-duplicate ACTIVE facts on the same entity are MERGED — the older
   *    restatement is superseded (kept as history, forward-linked to the kept
   *    fact), so recall stops surfacing three wordings of the same thing.
   *    Conservative: only when the older fact's content words are contained in
   *    the newer's, or overlap ≥ `overlap` (content words, stop-words dropped).
   *  • stale entities (not used/updated in `staleDays`) are PROPOSED for review
   *    — never auto-forgotten (forgetting is the user's call, R-MEM-04).
   * Bounded (≤200 entities, ≤30 facts each), audited, every merge reversible in
   * the sense that history is kept (status='superseded', superseded_by set).
   */
  async consolidate(opts?: { overlap?: number; staleDays?: number }): Promise<{
    entitiesScanned: number;
    duplicatesMerged: number;
    merged: string[];         // "entity: kept 'x' ⊃ superseded 'y'"
    entitiesMerged: number;   // cross-kind same-name entities folded together
    entityMerges: string[];   // "name: merged 'thing' into 'project'"
    staleProposals: string[]; // entity names proposed for review
  }> {
    const overlap = Math.min(0.95, Math.max(0.5, opts?.overlap ?? 0.7));
    const staleDays = Math.max(7, opts?.staleDays ?? 90);
    const merged: string[] = [];
    let duplicatesMerged = 0;

    const { rows: entities } = await this.pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM memory_entities WHERE status NOT IN ('deleted','superseded')
       ORDER BY updated_at DESC LIMIT 200`,
    );
    for (const e of entities) {
      const { rows: facts } = await this.pool.query<{ id: string; statement: string; created_at: string; sensitivity: string }>(
        `SELECT id, statement, created_at::text, sensitivity FROM memory_facts
         WHERE entity_id = $1 AND status NOT IN ('deleted','superseded')
         ORDER BY created_at ASC LIMIT 30`,
        [e.id],
      );
      if (facts.length < 2) continue;
      const decoded = facts.map((f) => ({ ...f, text: this.dec(f.statement), words: contentWords(this.dec(f.statement)) }));
      const gone = new Set<string>();

      // Prefer a fast-model MERGE JUDGMENT over string heuristics (D-0075): the
      // model reads the entity's facts and decides which RESTATE the same thing.
      // Attempted only when at least one pair shares a content word (a cheap gate
      // — no plausible dupes, no call) and a judge is present. Any failure or
      // ineligibility → null → the deterministic path below runs instead.
      let handledByJudge = false;
      if (this.judge && anyPairShareWord(decoded)) {
        const privacy = privacyForSensitivities(decoded.map((d) => d.sensitivity));
        const groups = await this.judge.mergeFacts(
          e.name,
          decoded.map((d, idx) => ({ idx, text: d.text })),
          privacy,
        );
        if (groups) {
          handledByJudge = true; // judged — trust the model's call (even if empty)
          for (const g of groups) {
            const keep = decoded[g.keep];
            if (!keep || gone.has(keep.id)) continue;
            for (const si of g.supersede) {
              const old = decoded[si];
              if (!old || gone.has(old.id) || old.id === keep.id) continue;
              // status re-check: skip if a LIVE write changed it since we read it
              const { rowCount } = await this.pool.query(
                `UPDATE memory_facts SET status = 'superseded', superseded_by = $1
                 WHERE id = $2 AND status NOT IN ('deleted','superseded')`,
                [keep.id, old.id],
              );
              if (!rowCount) continue;
              if (this.semantic) void this.semantic.remove("fact", old.id);
              gone.add(old.id);
              duplicatesMerged++;
              merged.push(`${e.name}: kept "${keep.text}" ⊇ superseded "${old.text}" (model)`);
            }
          }
        }
      }
      if (handledByJudge) continue;

      // Deterministic fallback: newer fact wins; compare each older fact against every newer one
      for (let i = 0; i < decoded.length; i++) {
        if (gone.has(decoded[i]!.id)) continue;
        for (let j = i + 1; j < decoded.length; j++) {
          if (gone.has(decoded[j]!.id)) continue;
          const a = decoded[i]!, b = decoded[j]!; // a older, b newer
          if (!a.words.size || !b.words.size) continue;
          let inter = 0;
          for (const w of a.words) if (b.words.has(w)) inter++;
          const contained = inter === a.words.size;                        // b restates a (with possibly more detail)
          const jac = inter / (new Set([...a.words, ...b.words]).size || 1);
          if (contained || jac >= overlap) {
            // status re-check: if a LIVE write superseded/deleted this fact
            // since we read it, leave it alone (no-collide with live updates)
            const { rowCount } = await this.pool.query(
              `UPDATE memory_facts SET status = 'superseded', superseded_by = $1
               WHERE id = $2 AND status NOT IN ('deleted','superseded')`,
              [b.id, a.id],
            );
            if (!rowCount) continue;
            if (this.semantic) void this.semantic.remove("fact", a.id);
            gone.add(a.id);
            duplicatesMerged++;
            merged.push(`${e.name}: kept "${b.text}" ⊃ superseded "${a.text}"`);
            break; // a is merged; move to the next older fact
          }
        }
      }
    }

    // Cross-kind entity de-duplication (D-0075 cross-kind): entities sharing a
    // NAME across different KINDS (the model labelled the same real-world thing
    // inconsistently across stateless sessions — 'arc reactor' as both a 'thing'
    // and a 'project') are merged via the judge — best-effort, NEVER automatic:
    // genuinely different things that merely share a name ('Mercury' the planet vs
    // the element) are left distinct. Bounded; supersede-with-history; facts +
    // relations migrated forward; live-collision-safe.
    let entitiesMerged = 0;
    const entityMerges: string[] = [];
    if (this.judge) {
      const { rows: nameGroups } = await this.pool.query<{ lname: string }>(
        `SELECT lower(name) AS lname FROM memory_entities WHERE status NOT IN ('deleted','superseded')
         GROUP BY lower(name) HAVING count(DISTINCT kind) > 1 LIMIT 50`,
      );
      for (const grp of nameGroups) {
        const { rows: ents } = await this.pool.query<{ id: string; name: string; kind: string }>(
          `SELECT id, name, kind FROM memory_entities
           WHERE lower(name) = $1 AND status NOT IN ('deleted','superseded')
           ORDER BY created_at ASC LIMIT 10`,
          [grp.lname],
        );
        if (ents.length < 2) continue;
        const forJudge: { idx: number; kind: string; facts: string[] }[] = [];
        const sens: string[] = [];
        for (let i = 0; i < ents.length; i++) {
          const { rows: fr } = await this.pool.query<{ statement: string; sensitivity: string }>(
            `SELECT statement, sensitivity FROM memory_facts WHERE entity_id = $1 AND status NOT IN ('deleted','superseded')
             ORDER BY created_at DESC LIMIT 3`,
            [ents[i]!.id],
          );
          forJudge.push({ idx: i, kind: ents[i]!.kind, facts: fr.map((f) => this.dec(f.statement)) });
          for (const f of fr) sens.push(f.sensitivity);
        }
        const mgroups = await this.judge.mergeEntities(ents[0]!.name, forJudge, privacyForSensitivities(sens));
        if (!mgroups) continue;
        const gone = new Set<string>();
        for (const g of mgroups) {
          const keep = ents[g.keep];
          if (!keep || gone.has(keep.id)) continue;
          for (const mi of g.merge) {
            const victim = ents[mi];
            if (!victim || victim.id === keep.id || gone.has(victim.id)) continue;
            if (await this.mergeEntityInto(victim.id, keep.id)) {
              gone.add(victim.id);
              entitiesMerged++;
              entityMerges.push(`${keep.name}: merged '${victim.kind}' into '${keep.kind}' (model)`);
            }
          }
        }
      }
    }

    const { rows: stale } = await this.pool.query<{ name: string }>(
      `SELECT name FROM memory_entities
       WHERE status NOT IN ('deleted','superseded')
         AND GREATEST(COALESCE(last_used_at, updated_at), updated_at) < now() - ($1 || ' days')::interval
       ORDER BY updated_at ASC LIMIT 10`,
      [staleDays],
    );
    if (duplicatesMerged || entitiesMerged || stale.length) {
      await this.audit.append({
        actor: "kernel",
        event: "memory_consolidated",
        payload: { entitiesScanned: entities.length, duplicatesMerged, entitiesMerged, staleProposed: stale.length },
      });
    }
    return {
      entitiesScanned: entities.length,
      duplicatesMerged,
      merged,
      entitiesMerged,
      entityMerges,
      staleProposals: stale.map((s) => s.name),
    };
  }

  /** Fold one entity into another (cross-kind de-dup, D-0075): migrate the
   *  victim's still-active facts + relations + aliases onto the keeper, then
   *  supersede the victim forward-linked. Live-collision-safe (re-checks both are
   *  active under the transaction). Returns false if it became a no-op. */
  private async mergeEntityInto(victimId: string, keepId: string): Promise<boolean> {
    if (victimId === keepId) return false;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: activeRows } = await client.query<{ id: string }>(
        `SELECT id FROM memory_entities WHERE id = ANY($1::uuid[]) AND status NOT IN ('deleted','superseded') FOR UPDATE`,
        [[victimId, keepId]],
      );
      const active = new Set(activeRows.map((r) => r.id));
      if (!active.has(victimId) || !active.has(keepId)) {
        await client.query("ROLLBACK");
        return false;
      }
      // absorb the victim's aliases (its NAME equals the keeper's here, so no new
      // name alias is needed) — stored lowercased, deduped.
      await client.query(
        `UPDATE memory_entities k SET aliases = ARRAY(SELECT DISTINCT lower(a) FROM unnest(k.aliases || v.aliases) a)
         FROM memory_entities v WHERE k.id = $1 AND v.id = $2`,
        [keepId, victimId],
      );
      await client.query(
        `UPDATE memory_facts SET entity_id = $1 WHERE entity_id = $2 AND status NOT IN ('deleted','superseded')`,
        [keepId, victimId],
      );
      await client.query(
        `UPDATE memory_relations r SET from_entity = $1
         WHERE r.from_entity = $2 AND r.to_entity <> $1
           AND NOT EXISTS (SELECT 1 FROM memory_relations x
             WHERE x.from_entity = $1 AND x.to_entity = r.to_entity AND x.relation = r.relation)`,
        [keepId, victimId],
      );
      await client.query(
        `UPDATE memory_relations r SET to_entity = $1
         WHERE r.to_entity = $2 AND r.from_entity <> $1
           AND NOT EXISTS (SELECT 1 FROM memory_relations x
             WHERE x.to_entity = $1 AND x.from_entity = r.from_entity AND x.relation = r.relation)`,
        [keepId, victimId],
      );
      await client.query(
        `UPDATE memory_entities SET status = 'superseded', superseded_by = $1, updated_at = now() WHERE id = $2`,
        [keepId, victimId],
      );
      await client.query("COMMIT");
      if (this.semantic) void this.semantic.remove("entity", victimId);
      await this.audit.append({ actor: "kernel", event: "entities_merged", payload: { keptId: keepId } });
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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
