import type { Tool, ToolResult } from "../core/tools.js";
import type { EntityMemory, GraphNeighborhood, GraphRecall, Recall } from "./entities.js";
import type { MemoryService } from "./memory.js";

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
      "If this REPLACES something already known (an update, change or correction), use memory.correct instead.",
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
      const f = await mem.rememberFact({
        entityName: a.entity,
        ...(a.kind ? { entityKind: a.kind } : {}),
        statement: a.statement,
        provenance: "conversation (user asked me to remember)",
      });
      return {
        ok: true,
        summary: `remembered a fact about '${a.entity}'`,
        data: { id: f.id, entity: a.entity },
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
          const f = await mem.rememberFact({
            entityName: a.entity,
            ...(a.kind ? { entityKind: a.kind } : {}),
            statement,
            provenance: "conversation (user asked me to remember)",
          });
          // write-then-verify: the fact must read back, active, with the same text
          const back = await mem.factById(f.id);
          if (back && back.statement === statement) items.push({ index: i + 1, statement, stored: true, factId: f.id });
          else items.push({ index: i + 1, statement, stored: false, factId: f.id, error: "written but did not read back intact" });
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
    description: "Record a relationship between two entities (from → relation → to). Reversible.",
    riskClass: "LOW_REVERSIBLE",
    action: "store relation in local memory",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        relation: { type: "string", description: "e.g. works_on, knows, located_in, owns, part_of" },
        note: { type: "string" },
      },
      required: ["from", "to", "relation"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { from: string; to: string; relation: string; note?: string };
      const r = await mem.relate({
        fromName: a.from,
        toName: a.to,
        relation: a.relation,
        ...(a.note ? { note: a.note } : {}),
        provenance: "conversation (user asked me to remember)",
      });
      return {
        ok: true,
        summary: `${a.from} —${a.relation}→ ${a.to}`,
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
      if (!r) return { ok: true, summary: `no memory of '${name}'`, data: null, detail: `Nothing known about '${name}'.` };
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
      if (!g) return { ok: true, summary: `no memory of '${a.name}'`, data: null, detail: `Nothing known about '${a.name}'.` };
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
      "Use this — NOT rememberFact — whenever the user updates/changes/corrects something you know, so the stale value doesn't linger alongside the new one.",
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
          const matches = await prefs.matchKeys(a.entity, a.replaces ?? a.newStatement);
          const unambiguous =
            matches.length === 1 || (matches.length > 1 && matches[0]!.hintOverlap > matches[1]!.hintOverlap);
          if (unambiguous) {
            const m = matches[0]!;
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

  return [rememberEntity, rememberFact, rememberFacts, correct, relate, recall, related, recallGraph, forget];
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

function renderGraphRecall(r: GraphRecall): string {
  const seeds = r.seeds?.length ? ` — entry points: ${r.seeds.map((s) => `${s.name} (${s.via})`).join(", ")}` : "";
  const lines = [`relevant knowledge (${r.mode}${seeds}):`];
  for (const e of r.entities) {
    lines.push(`  ${e.kind} — ${e.name}`);
    for (const f of e.facts) lines.push(`    · ${f}`);
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
