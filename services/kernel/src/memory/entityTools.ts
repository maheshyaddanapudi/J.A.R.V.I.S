import type { Tool, ToolResult } from "../core/tools.js";
import type { EntityMemory, GraphNeighborhood, GraphRecall, Recall } from "./entities.js";

/**
 * Semantic-memory tools. Writing to J.A.R.V.I.S.'s knowledge of the user's world
 * (entities/facts/relations) is LOW_REVERSIBLE (reversible via forget; auto only
 * when automation is delegated, else it prompts). Recall is READ_ONLY. The store
 * refuses secret-shaped content (R-MEM-06) and encrypts at rest (R-MEM-03).
 */
export function entityMemoryTools(mem: EntityMemory): Tool[] {
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
    description: "Remember a fact about a named entity (creates the entity if new). Reversible.",
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
    description: "Recall everything J.A.R.V.I.S. knows about a named entity (facts + relationships). Read-only.",
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
      "Hybrid recall over the knowledge graph: finds entities/facts relevant to a query BY MEANING, then expands to what they are connected to. Read-only.",
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
      "Correct a fact you already hold about an entity: supersede the old statement (kept as history) and record the new one. " +
      "READ-THEN-WRITE: call memory.recall first — it lists each fact with its factId — then pass the exact factId here. " +
      "Use this — NOT rememberFact — whenever the user updates/changes/corrects something you know, so the stale fact doesn't linger alongside the new one.",
    riskClass: "LOW_REVERSIBLE",
    action: "correct fact in local memory",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "the entity the fact is about" },
        newStatement: { type: "string", description: "the corrected/updated fact" },
        factId: { type: "string", description: "the exact id of the fact to supersede (from memory.recall) — PREFERRED" },
        replaces: { type: "string", description: "fallback: text of the OLD fact to supersede, if you don't have its factId" },
        kind: { type: "string", description: "entity kind if it must be created" },
      },
      required: ["entity", "newStatement"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { entity: string; newStatement: string; factId?: string; replaces?: string; kind?: string };
      try {
        const r = await mem.correctFact({
          entityName: a.entity,
          newStatement: a.newStatement,
          ...(a.factId ? { factId: a.factId } : {}),
          ...(a.replaces ? { replaces: a.replaces } : {}),
          ...(a.kind ? { entityKind: a.kind } : {}),
          provenance: "conversation (user corrected me)",
        });
        return {
          ok: true,
          summary: r.supersededCount
            ? `corrected '${a.entity}' — superseded ${r.supersededCount} prior fact${r.supersededCount > 1 ? "s" : ""}, kept as history`
            : `recorded a new fact about '${a.entity}' (no prior statement matched to supersede — recall the entity and pass a factId to target precisely)`,
          data: { id: r.fact.id, entity: a.entity, superseded: r.supersededCount },
        };
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

  return [rememberEntity, rememberFact, correct, relate, recall, related, recallGraph, forget];
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
  const lines = [`relevant knowledge (${r.mode} entry points + graph expansion):`];
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
