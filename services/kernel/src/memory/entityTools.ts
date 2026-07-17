import type { Tool, ToolResult } from "../core/tools.js";
import type { EntityMemory, Recall } from "./entities.js";

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

  return [rememberEntity, rememberFact, relate, recall];
}

function renderRecall(r: Recall): string {
  const lines = [`${r.entity.kind} — ${r.entity.name}${r.entity.attributes ? ` (${r.entity.attributes})` : ""}`];
  if (r.facts.length) {
    lines.push("facts:");
    for (const f of r.facts) lines.push(`  - ${f.statement} [${f.status}]`);
  }
  for (const rel of r.relationsOut) lines.push(`  → ${rel.relation} → ${rel.toKind} ${rel.toName}${rel.note ? ` (${rel.note})` : ""}`);
  for (const rel of r.relationsIn) lines.push(`  ← ${rel.fromKind} ${rel.fromName} ${rel.relation} → this`);
  return lines.join("\n");
}
