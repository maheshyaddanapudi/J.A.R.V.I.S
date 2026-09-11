import type { Tool, ToolResult } from "../core/tools.js";
import { qualifierTwin, type EntityMemory, type GraphNeighborhood, type GraphRecall, type Recall } from "./entities.js";
import { normalizeKeyTokens, type MemoryService } from "./memory.js";

/**
 * D-0080 R-MEM-08 "one home" guard for WRITES: a new fact whose statement
 * names the whole attribute that a stored preference already holds for this
 * subject ('south beacon five's service day is Tuesday' while
 * `south_beacon_five_service_day = Thursday` exists) is an UPDATE in disguise.
 * Mini-life 2026-09-01 round D: the agent chose rememberFact for such a flip,
 * so no correction ran, the preference kept the stale value and the graph got
 * a second home. Returns the preference that already holds the attribute, or
 * null. A statement mentioning only part of the attribute ('needs service')
 * is a different fact and passes.
 */
async function preferenceHome(
  prefs: MemoryService | undefined,
  entity: string,
  statement: string,
): Promise<{ key: string; value: string } | null> {
  if (!prefs) return null;
  const subject = normalizeKeyTokens(entity);
  const words = normalizeKeyTokens(statement);
  for (const m of await prefs.matchKeys(entity, statement)) {
    const attr = [...normalizeKeyTokens(m.key)].filter((t) => !subject.has(t));
    if (attr.length > 0 && attr.every((t) => words.has(t))) return { key: m.key, value: m.value };
  }
  return null;
}

/**
 * Which of the preferences about a subject a correction means (D-0080 B1).
 * Second-act audit 2026-09-02: 'morning_swim_status_colour' vs its twin
 * 'morning swim two status colour' tie on attribute overlap (the twin's tokens
 * are a superset), and the agent sometimes passes the KEY itself as the entity
 * ('preferred_workday_start' beside 'weekend_preferred_workday_start') — both
 * were refused as ambiguous and the flips never landed. Order:
 *   1. a key whose tokens equal the subject's or the hint's tokens exactly;
 *   2. the best attribute-hint overlap;
 *   3. on an overlap tie, the key with FEWER extra tokens (closest to the
 *      subject — the twin carries 'two');
 *   4. otherwise genuinely ambiguous → null (the caller refuses, writes nothing).
 */
function pickPreference(
  matches: { key: string; value: string; hintOverlap: number; extra: number }[],
  entity: string,
  hint: string | undefined,
): { key: string; value: string } | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((t) => b.has(t));
  const subject = normalizeKeyTokens(entity);
  const hintToks = hint ? normalizeKeyTokens(hint) : null;
  const exact = matches.find((m) => {
    const k = normalizeKeyTokens(m.key);
    return same(k, subject) || (hintToks !== null && same(k, hintToks));
  });
  if (exact) return exact;
  const [top, second] = matches; // matchKeys sorts by hintOverlap desc, extra asc
  if (top!.hintOverlap > second!.hintOverlap) return top!;
  if (top!.hintOverlap === second!.hintOverlap && top!.extra < second!.extra) return top!;
  return null;
}

function updateInDisguise(entity: string, statement: string, home: { key: string; value: string }): string {
  return (
    `refused: "${statement}" looks like an UPDATE to what I already hold for '${entity}' — preference '${home.key}' = '${home.value}'. ` +
    `Use memory.correct (it corrects the preference with history) so the old value doesn't linger beside a new fact.`
  );
}

/** Entities the agent uses to mean the user themself. */
const SELF_ENTITY = /^(the\s+)?(user|me|myself|i|owner|you|principal)$/i;
const FIRST_PERSON = /^\s*(?:my|our)\s+(.+?)\s+(?:is|are|was|=|:)\s+(.+?)\s*[.!]?\s*$/i;

/**
 * Longitude-XL gap G-05 (2026-09-11): a first-person statement — "my study
 * plant is basil", "my gym day is friday" — is a PREFERENCE, but the agent
 * wrote three of them as entity facts (on a thing named `study plant`, on a
 * thing named `bike`, on an entity named `user`), where
 * `memory.recallPreferences` cannot see them; every one of chapter two's seven
 * misses was one of those three facts. Mirror of the update-in-disguise guard:
 * when the statement is "my X is Y" and the entity IS that X (or the user),
 * refuse and hand the agent the exact preference write instead. Returns the
 * suggested key/value, or null when the statement is a genuine third-person
 * fact ("my sister is Anna" on entity 'Anna' passes — it is about Anna).
 */
export function preferenceInDisguise(
  entity: string,
  statement: string,
): { key: string; value: string; subject: string } | null {
  const m = FIRST_PERSON.exec(statement);
  if (!m) return null;
  const subject = m[1]!.trim();
  const value = m[2]!.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
  const subj = normalizeKeyTokens(subject);
  const ent = normalizeKeyTokens(entity);
  const covers = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((t) => b.has(t));
  const aboutSelf = SELF_ENTITY.test(entity.trim()) || covers(ent, subj) || covers(subj, ent);
  if (!aboutSelf || !value) return null;
  const key = subject.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key ? { key, value, subject } : null;
}

/**
 * Longitude-XL gap G-18 (2026-09-11): the agent writes facts WITHOUT their
 * subject — "Status colour is teal" on the entity row — so once two things
 * share a row nothing in the store can say which one a fact belonged to (nine
 * folded twins could not be split from evidence). A statement that does not
 * name its entity is stored prefixed with it: "coral census two: Status colour
 * is teal". A statement that already names the entity is stored verbatim.
 */
export function withSubject(entity: string, statement: string): string {
  const s = statement.trim();
  if (!s) return statement; // an empty statement stays empty so the store refuses it
  const toks = entity.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  const low = s.toLowerCase();
  const named = toks.length > 0 && toks.every((t) => new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(low));
  return named ? s : `${entity.trim()}: ${s}`;
}

function preferenceNotFact(entity: string, statement: string, p: { key: string; value: string; subject: string }): string {
  return (
    `refused: "${statement}" is a first-person PREFERENCE about the user (their ${p.subject}), not a fact about a thing called '${entity}'. ` +
    `Store it with memory.remember (key "${p.key}", value "${p.value}") so memory.recallPreferences can find it later; ` +
    `entity facts are for people, places and things in the user's world.`
  );
}

/**
 * Semantic-memory tools. Writing to J.A.R.V.I.S.'s knowledge of the user's world
 * (entities/facts/relations) is LOW_REVERSIBLE (reversible via forget; auto only
 * when automation is delegated, else it prompts). Recall is READ_ONLY. The store
 * refuses secret-shaped content (R-MEM-06) and encrypts at rest (R-MEM-03).
 *
 * @param prefs the preference store — when given, `memory.correct` is
 *   ROUTE-AGNOSTIC (D-0080 B1, R-MEM-08): a value that lives in preferences is
 *   corrected there instead of being re-invented as an entity fact.
 */
export function entityMemoryTools(mem: EntityMemory, prefs?: MemoryService): Tool[] {
  const rememberEntity: Tool = {
    name: "memory.rememberEntity",
    description: "Remember an entity in J.A.R.V.I.S.'s knowledge (kind + name, optional attributes). Reversible.",
    riskClass: "LOW_REVERSIBLE",
    action: "store entity in local memory",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", description: "person | project | place | org | thing | topic" },
        name: { type: "string" },
        attributes: { type: "string", description: "free-text notes (encrypted at rest)" },
      },
      required: ["kind", "name"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { kind: string; name: string; attributes?: string };
      const e = await mem.rememberEntity({
        kind: a.kind,
        name: a.name,
        ...(a.attributes ? { attributes: a.attributes } : {}),
        provenance: "conversation (user asked me to remember)",
      });
      return {
        ok: true,
        summary: `remembered ${e.kind} '${e.name}'`,
        data: { id: e.id, name: e.name, kind: e.kind },
        rollback: async () => { await mem.forgetEntity(e.name); },
      };
    },
  };

  const rememberFact: Tool = {
    name: "memory.rememberFact",
    description:
      "Remember ONE new fact about a named entity (creates the entity if new). Reversible. " +
      "If the user gives several things to remember at once, use memory.rememberFacts (one call, all of them). " +
      "If this REPLACES something already known (an update, change or correction), use memory.correct instead. " +
      "A first-person statement about the user ('my gym day is Friday', 'my bike colour is olive') is a PREFERENCE — " +
      "store it with memory.remember, not as a fact on a thing. Write the statement so it NAMES the entity " +
      "('coral census two's status colour is teal', not 'status colour is teal'); a statement without the name is stored prefixed with it. " +
      "The result quotes what was actually stored (read back) — relay that to the user.",
    riskClass: "LOW_REVERSIBLE",
    action: "store fact in local memory",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "the entity the fact is about" },
        kind: { type: "string", description: "entity kind if it must be created" },
        statement: { type: "string" },
      },
      required: ["entity", "statement"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { entity: string; kind?: string; statement: string };
      const pref = prefs ? preferenceInDisguise(a.entity, a.statement) : null;
      if (pref) {
        return { ok: false, summary: preferenceNotFact(a.entity, a.statement, pref), data: { route: "preference", key: pref.key, value: pref.value, write: "memory.remember" } };
      }
      const home = await preferenceHome(prefs, a.entity, a.statement);
      if (home) {
        return { ok: false, summary: updateInDisguise(a.entity, a.statement, home), data: { route: "preference", key: home.key, value: home.value } };
      }
      const statement = withSubject(a.entity, a.statement);
      const f = await mem.rememberFact({
        entityName: a.entity,
        ...(a.kind ? { entityKind: a.kind } : {}),
        statement,
        provenance: "conversation (user asked me to remember)",
      });
      // G-01 teach receipt: the write is confirmed by READING IT BACK, and the
      // reply carries the stored text verbatim — never "remembered" on trust.
      const back = await mem.factById(f.id);
      if (!back || back.statement !== statement) {
        return { ok: false, summary: `written but did not read back intact — '${a.entity}': "${statement}" (factId ${f.id})`, data: { id: f.id, entity: a.entity, readBack: false } };
      }
      return {
        ok: true,
        summary: `remembered and read back — '${a.entity}': "${back.statement}" (factId ${f.id})`,
        data: { id: f.id, entity: a.entity, statement: back.statement, readBack: true },
      };
    },
  };

  // D-0080 B2 (R-MEM-09): Longitude-XL saw a 2-statement teach lose its second
  // statement — the model simply never issued the second rememberFact call. One
  // call for N statements removes the per-item skip; each item is written and
  // RE-READ individually, and a partial failure is reported per item, never
  // masked behind the successes.
  const rememberFacts: Tool = {
    name: "memory.rememberFacts",
    description:
      "Remember SEVERAL new facts about one named entity in ONE call (creates the entity if new). " +
      "Use this whenever the user gives two or more things to remember at once — every statement is stored " +
      "and re-read individually, with a per-item result. Reversible. For a change to something already known, use memory.correct.",
    riskClass: "LOW_REVERSIBLE",
    action: "store facts in local memory",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "the entity the facts are about" },
        kind: { type: "string", description: "entity kind if it must be created" },
        statements: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 25,
          description: "one complete statement per item, each naming the attribute (e.g. \"tessa novak is based in Cusco\")",
        },
      },
      required: ["entity", "statements"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { entity: string; kind?: string; statements: unknown };
      const statements = Array.isArray(a.statements) ? a.statements.map((s) => String(s ?? "")) : [];
      if (!statements.length) return { ok: false, summary: "give at least one statement" };
      const items: { index: number; statement: string; stored: boolean; factId?: string; error?: string }[] = [];
      for (const [i, statement] of statements.entries()) {
        try {
          const pref = prefs ? preferenceInDisguise(a.entity, statement) : null;
          if (pref) {
            items.push({ index: i + 1, statement, stored: false, error: preferenceNotFact(a.entity, statement, pref) });
            continue;
          }
          const home = await preferenceHome(prefs, a.entity, statement);
          if (home) {
            items.push({ index: i + 1, statement, stored: false, error: updateInDisguise(a.entity, statement, home) });
            continue;
          }
          const subjectful = withSubject(a.entity, statement);
          const f = await mem.rememberFact({
            entityName: a.entity,
            ...(a.kind ? { entityKind: a.kind } : {}),
            statement: subjectful,
            provenance: "conversation (user asked me to remember)",
          });
          // write-then-verify: the fact must read back, active, with the same text
          const back = await mem.factById(f.id);
          if (back && back.statement === subjectful) items.push({ index: i + 1, statement: subjectful, stored: true, factId: f.id });
          else items.push({ index: i + 1, statement: subjectful, stored: false, factId: f.id, error: "written but did not read back intact" });
        } catch (err) {
          items.push({ index: i + 1, statement, stored: false, error: err instanceof Error ? err.message : String(err) });
        }
      }
      const stored = items.filter((it) => it.stored);
      const failed = items.filter((it) => !it.stored);
      const ok = failed.length === 0;
      return {
        ok,
        summary: ok
          ? `remembered ${stored.length}/${items.length} fact${items.length > 1 ? "s" : ""} about '${a.entity}' (each re-read)`
          : `stored ${stored.length} of ${items.length} facts about '${a.entity}' — ${failed.map((f) => `item ${f.index} failed: ${f.error}`).join("; ")}`,
        data: { entity: a.entity, stored: stored.length, failed: failed.length, items },
        detail: items.map((it) => `${it.index}. ${it.stored ? "✓" : "✗"} ${it.statement}${it.stored ? ` (factId: ${it.factId})` : ` — ${it.error}`}`).join("\n"),
        ...(stored.length
          ? { rollback: async () => { for (const it of stored) if (it.factId) await mem.forgetFact(it.factId); } }
          : {}),
      };
    },
  };

  const relate: Tool = {
    name: "memory.relate",
    description:
      "Record a relationship between two entities (from → relation → to). Reversible. " +
      "A statement that CONNECTS two things — X is located at Y, P maintains D, S supplies D, A depends on B — is a relation: store it here " +
      "(traversable for multi-hop questions), not as a fact sentence. " +
      "Exclusive relations — located_in (a thing is in ONE place), maintains (a device has ONE maintainer of record), owns, reports_to — " +
      "REPLACE the previous edge with history; pass additive:true when both should hold ('she ALSO maintains it'). " +
      "Use each entity's full name exactly as taught ('kiln north', 'coral census two' — never shortened to 'kiln' or 'coral census').",
    riskClass: "LOW_REVERSIBLE",
    action: "store relation in local memory",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        relation: { type: "string", description: "e.g. works_on, knows, located_in, owns, part_of, maintains, supplies, depends_on" },
        note: { type: "string" },
        additive: { type: "boolean", description: "keep an existing edge on an exclusive relation instead of replacing it" },
      },
      required: ["from", "to", "relation"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { from: string; to: string; relation: string; note?: string; additive?: boolean };
      const r = await mem.relate({
        fromName: a.from,
        toName: a.to,
        relation: a.relation,
        ...(a.note ? { note: a.note } : {}),
        ...(a.additive ? { additive: true } : {}),
        provenance: "conversation (user asked me to remember)",
      });
      const replaced = r.replaced.length ? ` (replaced ${r.replaced.map((x) => `${x.fromName} —${x.relation}→ ${x.toName}`).join(", ")}; kept in history)` : "";
      return {
        ok: true,
        summary: `${a.from} —${a.relation}→ ${a.to}${replaced}`,
        data: { id: r.id },
      };
    },
  };

  const recall: Tool = {
    name: "memory.recall",
    description: "Recall everything J.A.R.V.I.S. knows about an entity BY EXACT NAME (facts + relationships). Use this when the question names the thing. Read-only.",
    riskClass: "READ_ONLY",
    action: "recall entity knowledge",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { name } = args as { name: string };
      const r = await mem.recall(name);
      if (!r) return { ok: true, summary: `no memory of '${name}'`, data: null, detail: await missWithNearNames(mem, name) };
      return {
        ok: true,
        summary: `${r.entity.kind} '${r.entity.name}': ${r.facts.length} fact(s), ${r.relationsOut.length + r.relationsIn.length} relation(s)`,
        data: r,
        detail: renderRecall(r),
      };
    },
  };

  const related: Tool = {
    name: "memory.related",
    description:
      "Walk the knowledge graph from a named entity — what is connected to it, and what is connected to those (multi-hop). Read-only.",
    riskClass: "READ_ONLY",
    action: "traverse knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        depth: { type: "number", description: "hops to walk (1-3, default 2)" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name: string; depth?: number };
      const g = await mem.traverse(a.name, a.depth ?? 2);
      if (!g) return { ok: true, summary: `no memory of '${a.name}'`, data: null, detail: await missWithNearNames(mem, a.name) };
      return {
        ok: true,
        summary: `${g.nodes.length} entity(ies), ${g.edges.length} relation(s) within ${a.depth ?? 2} hop(s) of '${a.name}'`,
        data: g,
        detail: renderNeighborhood(g),
      };
    },
  };

  const recallGraph: Tool = {
    name: "memory.recallGraph",
    description:
      "Hybrid recall over the knowledge graph: entities NAMED in the query seed first (most specific name wins), then entities/facts relevant BY MEANING, then one hop to what they are connected to. Read-only.",
    riskClass: "READ_ONLY",
    action: "hybrid graph recall",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { query } = args as { query: string };
      const r = await mem.recallGraph(query);
      if (r.entities.length === 0) {
        return { ok: true, summary: "nothing relevant in the knowledge graph", data: r, detail: "The knowledge graph has nothing relevant to that." };
      }
      return {
        ok: true,
        summary: `${r.entities.length} entity(ies) + ${r.relations.length} relation(s) recalled (${r.mode})`,
        data: r,
        detail: renderGraphRecall(r),
      };
    },
  };

  const correct: Tool = {
    name: "memory.correct",
    description:
      "Correct something you already hold: supersede the old value (kept as history) and record the new one. " +
      "Works for entity facts AND preferences — if no entity fact matches, the preference holding the value is corrected instead, so a value keeps ONE home. " +
      "READ-THEN-WRITE: call memory.recall first — it lists each fact with its factId — then pass the exact factId here; otherwise name the attribute in `replaces`. " +
      "Use this — NOT rememberFact — whenever the user updates/changes/corrects something you know, so the stale value doesn't linger alongside the new one. " +
      "Pass the entity's full name exactly as taught ('coral census two', 'kiln north'); 'coral census' and 'coral census two' are different things.",
    riskClass: "LOW_REVERSIBLE",
    action: "correct fact in local memory",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "the entity the fact is about" },
        newStatement: { type: "string", description: "the corrected/updated fact as a full statement" },
        value: { type: "string", description: "the bare new value when the change is a single attribute value (e.g. \"68\") — stored as-is if the fact lives in preferences" },
        factId: { type: "string", description: "the exact id of the fact to supersede (from memory.recall) — PREFERRED" },
        replaces: { type: "string", description: "the attribute or old text being replaced (e.g. \"assigned number\") — used to find the right fact or preference when you have no factId" },
        kind: { type: "string", description: "entity kind if it must be created" },
      },
      required: ["entity", "newStatement"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { entity: string; newStatement: string; value?: string; factId?: string; replaces?: string; kind?: string };
      const provenance = "conversation (user corrected me)";
      const viaFact = async () => {
        const r = await mem.correctFact({
          entityName: a.entity,
          newStatement: a.newStatement,
          ...(a.factId ? { factId: a.factId } : {}),
          ...(a.replaces ? { replaces: a.replaces } : {}),
          ...(a.kind ? { entityKind: a.kind } : {}),
          provenance,
        });
        return {
          ok: true,
          summary: r.supersededCount
            ? `corrected '${a.entity}' — superseded ${r.supersededCount} prior fact${r.supersededCount > 1 ? "s" : ""}, kept as history`
            : `recorded a new fact about '${a.entity}' (nothing matched to supersede in facts or preferences — recall the entity and pass a factId to target precisely)`,
          data: { route: "fact" as const, id: r.fact.id, entity: a.entity, superseded: r.supersededCount },
        };
      };
      try {
        // Resolution order (D-0080 B1, R-MEM-08): 1. factId  2. entity-fact text
        // match  3. a preference whose key names this subject  4. new fact.
        // Steps 1-2 are a READ-ONLY probe first, so step 3 can run before any
        // write invents a second home for a value that lives in preferences.
        const probe = await mem.correctionTargets({
          entityName: a.entity,
          newStatement: a.newStatement,
          ...(a.factId ? { factId: a.factId } : {}),
          ...(a.replaces ? { replaces: a.replaces } : {}),
        });
        if (a.factId || probe.targets.length) return await viaFact();
        if (prefs) {
          // the attribute hint: what the model says it replaces, else the new statement itself
          const hint = a.replaces ?? a.newStatement;
          const matches = await prefs.matchKeys(a.entity, hint);
          const m = pickPreference(matches, a.entity, hint);
          if (m) {
            const updated = await prefs.correct(m.key, a.value ?? a.newStatement, provenance);
            return {
              ok: true,
              summary: `corrected preference '${m.key}': '${m.value}' → '${updated?.value ?? a.value ?? a.newStatement}' (prior value kept as history)`,
              data: { route: "preference" as const, key: m.key, from: m.value, to: updated?.value, entity: a.entity },
            };
          }
          if (matches.length > 1) {
            return {
              ok: false,
              summary: `ambiguous — ${matches.length} preferences are about '${a.entity}' (${matches.map((m) => m.key).join(", ")}); say which attribute in 'replaces' and try again (nothing was changed)`,
              data: { route: "preference" as const, candidates: matches.map((m) => m.key) },
            };
          }
        }
        return await viaFact();
      } catch (err) {
        // e.g. a stale/wrong factId — surfaced to the model so it can re-recall.
        return { ok: false, summary: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const forget: Tool = {
    name: "memory.forget",
    description:
      "Forget (soft-delete) knowledge — excluded from recall immediately. Whole entity by name, or ONE fact by its factId " +
      "(from memory.recall) when only a single statement is no longer true. Look names/factIds up with memory.recall first if unsure.",
    riskClass: "CONSEQUENTIAL",
    action: "forget from local memory",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "entity to forget entirely (with its facts)" },
        factId: { type: "string", description: "OR: forget just this one fact (id from memory.recall)" },
      },
      additionalProperties: false,
    },
    disclose(args: unknown) {
      const a = args as { name?: string; factId?: string };
      const what = a.factId ? `one fact (${a.factId})` : `entity '${a.name}' and its facts`;
      return {
        whatWillHappen: `${what} will be forgotten (soft-deleted; excluded from recall immediately)`,
        affected: [a.factId ? `memory fact ${a.factId}` : `memory entity '${a.name}'`],
        proposedCommands: [`forget ${a.factId ?? `'${a.name}'`}`],
        reason: "user asked me to forget it",
        riskClass: "CONSEQUENTIAL" as const,
        reversible: false,
        rollbackPlan: "none — forgetting is a deliberate removal",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name?: string; factId?: string };
      if (a.factId) {
        const ok = await mem.forgetFact(a.factId);
        return ok
          ? { ok: true, summary: `forgot fact ${a.factId}`, data: { factId: a.factId, forgotten: true } }
          : { ok: true, summary: `no active fact ${a.factId} to forget (recall the entity for current factIds)`, data: { factId: a.factId, forgotten: false } };
      }
      if (!a.name) return { ok: false, summary: "give an entity name or a factId" };
      const ok = await mem.forgetEntity(a.name);
      return ok
        ? { ok: true, summary: `forgot '${a.name}'`, data: { name: a.name, forgotten: true } }
        : { ok: true, summary: `no active memory of '${a.name}' to forget`, data: { name: a.name, forgotten: false } };
    },
  };

  // Longitude-XL E-02 (2026-09-11): a quiz-shaped question ("what is X's Y?")
  // cost 8–10 agent steps per five questions — recall per entity, preferences
  // per question, a graph query on top — each step re-sending the catalogue.
  // One call answers several questions: for each, the entities named in it
  // (exact names first, twins flagged as different), their facts and
  // relations, the preferences that match, and first-person entity facts.
  const lookup: Tool = {
    name: "memory.lookup",
    description:
      "Answer one or several memory questions in ONE call — for each question: the entities it names (exact names; look-alikes flagged as DIFFERENT), " +
      "their facts and relations, matching preferences, and first-person facts. Use this for 'what is X's Y?', 'where is X located?', " +
      "'what is my Z?' and for batches ('answer these N'); one call replaces recall + recallPreferences + recallGraph per question. Read-only.",
    riskClass: "READ_ONLY",
    action: "answer memory questions",
    inputSchema: {
      type: "object",
      properties: {
        queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12, description: "the questions, one per item" },
      },
      required: ["queries"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { queries: unknown };
      const queries = Array.isArray(a.queries) ? a.queries.map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, 12) : [];
      if (!queries.length) return { ok: false, summary: "give at least one question" };
      const { rankPreferences, entityFactsFor, PREFERENCE_RECALL_CAP } = await import("../core/tools/recallPreferences.js");
      const allPrefs = prefs ? (await prefs.list()).filter((p) => !/^(reasoning_|gateway_|a2ui_|lab_)/.test(p.key)) : [];
      const sections: string[] = [];
      let entitiesFound = 0;
      for (const [i, q] of queries.entries()) {
        const lines: string[] = [`${i + 1}) ${q}`];
        const g = await mem.recallGraph(q, 4);
        const named = g.seeds.filter((s) => s.via === "identity").map((s) => s.name);
        entitiesFound += named.length;
        if (named.length) {
          for (const e of g.entities.filter((x) => named.some((n) => n.toLowerCase() === x.name.toLowerCase()))) {
            const r = await mem.recall(e.name);
            lines.push(`   ${e.kind} — ${e.name} (named in the question)`);
            for (const f of r?.facts ?? []) lines.push(`     · ${f.statement}`);
            for (const rel of r?.relationsOut ?? []) lines.push(`     → ${rel.relation} → ${rel.toName}`);
            for (const rel of r?.relationsIn ?? []) lines.push(`     ← ${rel.fromName} —${rel.relation}→`);
            if (!(r?.facts.length || r?.relationsOut.length || r?.relationsIn.length)) lines.push(`     (nothing recorded)`);
          }
          let others = g.entities.filter((x) => !named.some((n) => n.toLowerCase() === x.name.toLowerCase())).map((x) => x.name);
          if (!others.length) others = (await mem.nearNames(named[0]!, 4).catch(() => [])).map((n) => n.name);
          if (others.length) lines.push(`   also similar but DIFFERENT entities: ${others.join(", ")} — do not answer about ${named[0]} from them`);
        } else {
          const near = await mem.nearNames(q.replace(/^(what|which|where|who|is|are)\b.*?\b(the|my)\s+/i, "").replace(/['’]s\b.*$/, "").trim(), 4).catch(() => []);
          lines.push(near.length ? `   no entity named in the question; similarly named but DIFFERENT entities exist: ${near.map((n) => n.name).join(", ")}` : `   no entity named in the question`);
        }
        if (prefs) {
          const { ranked, total } = rankPreferences(allPrefs, q);
          const top = ranked.slice(0, Math.min(6, PREFERENCE_RECALL_CAP));
          if (top.length) {
            lines.push(`   preferences: ${top.map((p) => `${p.key} = ${p.sensitivity === "private" || p.sensitivity === "secret" ? "[withheld]" : p.value}`).join("; ")}${total > top.length ? ` (+${total - top.length} looser)` : ""}`);
          }
          const first = await entityFactsFor(mem, q, 3);
          if (first.length) lines.push(`   first-person facts: ${first.join("; ")}`);
        }
        sections.push(lines.join("\n"));
      }
      return {
        ok: true,
        summary: `${queries.length} question(s) looked up — ${entitiesFound} named entity match(es)`,
        data: { queries: queries.length, entitiesFound },
        detail: sections.join("\n") + "\nAnswer each question only from the entity it names (or the matching preference); say 'not found' when nothing above holds the asked value.",
      };
    },
  };

  return [rememberEntity, rememberFact, rememberFacts, correct, relate, recall, related, recallGraph, lookup, forget];
}

function renderNeighborhood(g: GraphNeighborhood): string {
  const lines = ["knowledge-graph neighborhood:"];
  for (const n of g.nodes) lines.push(`  ${"  ".repeat(n.depth)}${n.depth === 0 ? "●" : "○"} ${n.kind} ${n.name}${n.depth ? ` (${n.depth} hop${n.depth > 1 ? "s" : ""})` : ""}`);
  if (g.edges.length) {
    lines.push("relations:");
    for (const e of g.edges) lines.push(`  ${e.fromName} —${e.relation}→ ${e.toName}${e.note ? ` (${e.note})` : ""}`);
  }
  return lines.join("\n");
}

/**
 * G-02/G-04 (2026-09-11): a miss must not invite the agent to answer from a
 * sibling. Name the similarly-named entities that DO exist, explicitly as
 * different things — Longitude-XL saw 'coral census' answered from 'coral
 * census two' 5/5 and two-hop chains resolved through 'kiln north' for 'kiln'.
 */
async function missWithNearNames(mem: EntityMemory, name: string): Promise<string> {
  let near: { name: string; kind: string; twin: boolean }[] = [];
  try {
    near = await mem.nearNames(name);
  } catch {
    near = [];
  }
  if (!near.length) return `Nothing known about '${name}'.`;
  return (
    `Nothing known about '${name}'. Similarly named but DIFFERENT entities exist — ${near.map((n) => `${n.kind} '${n.name}'`).join(", ")} — ` +
    `do not answer a question about '${name}' from them; say '${name}' is not found (you may mention that '${near[0]!.name}' is known separately).`
  );
}

/** Does `other` look like a sibling/near-name of `named` — a qualifier twin, a
 *  word-bounded containment, or a close spelling ('tidal gauge two' for 'tide
 *  gauge')? Such entities are tagged DIFFERENT so the agent never answers a
 *  question about `named` from them. */
function lookalike(named: string, other: string): boolean {
  const a = named.toLowerCase().trim();
  const b = other.toLowerCase().trim();
  if (a === b) return false;
  if (qualifierTwin(a, b)) return true;
  const wb = (s: string) => new RegExp(`(^|[^a-z0-9])${s.replace(/[^a-z0-9]+/g, "[^a-z0-9]+")}([^a-z0-9]|$)`);
  if (wb(a).test(b) || wb(b).test(a)) return true;
  const ta = a.split(/\s+/);
  const tb = b.split(/\s+/);
  // same word count ±1 and every word of the shorter is a prefix-match (≥4 chars) of a word in the longer
  const [s, l] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (l.length - s.length > 1) return false;
  const stem = (w: string) => w.slice(0, 3); // "tide"/"tidal", "kiln"/"kilns"
  return s.filter((w) => w.length >= 4).every((w) => l.some((x) => stem(x) === stem(w))) && s.some((w) => w.length >= 4);
}

function renderGraphRecall(r: GraphRecall): string {
  const via = new Map((r.seeds ?? []).map((s) => [s.name.toLowerCase(), s.via]));
  const named = (r.seeds ?? []).filter((s) => s.via === "identity").map((s) => s.name);
  const seeds = r.seeds?.length ? ` — entry points: ${r.seeds.map((s) => `${s.name} (${s.via})`).join(", ")}` : "";
  const lines = [`relevant knowledge (${r.mode}${seeds}):`];
  if (named.length) lines.push(`  named in your query (exact): ${named.join(", ")} — anything tagged DIFFERENT below is another entity; do not answer about ${named.join(' / ')} from it.`);
  for (const e of r.entities) {
    const v = via.get(e.name.toLowerCase());
    const twinOf = v === "identity" ? undefined : named.find((n) => lookalike(n, e.name));
    const tag =
      v === "identity" ? " (named in your query)"
      : twinOf ? ` (${v === "similarity" ? "similar" : "connected"} — a DIFFERENT entity from '${twinOf}')`
      : v === "similarity" ? (named.length ? " (similar — a DIFFERENT entity)" : " (similar)")
      : " (connected)";
    lines.push(`  ${e.kind} — ${e.name}${tag}`);
    for (const f of e.facts) lines.push(`    · ${f}`);
    if (v === "identity") {
      const mine = r.relations.filter((rel) => rel.fromName.toLowerCase() === e.name.toLowerCase() || rel.toName.toLowerCase() === e.name.toLowerCase());
      if (!mine.length) lines.push(`    ↔ no connections recorded for ${e.name}`);
    }
  }
  if (named.length) {
    lines.push(`answer only about ${named.join(" / ")}; every other entity above is a different thing — if ${named[0]} lacks the asked fact or connection, say it is not found rather than substituting a look-alike.`);
  }
  if (r.relations.length) {
    lines.push("connections:");
    for (const rel of r.relations) lines.push(`  ${rel.fromName} —${rel.relation}→ ${rel.toName}`);
  }
  return lines.join("\n");
}

function renderRecall(r: Recall): string {
  const lines = [`${r.entity.kind} — ${r.entity.name}${r.entity.attributes ? ` (${r.entity.attributes})` : ""}`];
  if (r.facts.length) {
    // Fact ids are surfaced so the model can READ-then-WRITE precisely:
    // recall → decide → memory.correct/forget with the exact factId (no guessing).
    lines.push("facts:");
    for (const f of r.facts) lines.push(`  - ${f.statement} [${f.status}] (factId: ${f.id})`);
  }
  for (const rel of r.relationsOut) lines.push(`  → ${rel.relation} → ${rel.toKind} ${rel.toName}${rel.note ? ` (${rel.note})` : ""}`);
  for (const rel of r.relationsIn) lines.push(`  ← ${rel.fromKind} ${rel.fromName} ${rel.relation} → this`);
  return lines.join("\n");
}
