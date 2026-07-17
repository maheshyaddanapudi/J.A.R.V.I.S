import type { Tool, ToolResult } from "../core/tools.js";
import type { EpisodicMemory, Episode, EpisodeKind } from "./episodes.js";

/**
 * Episodic-memory tools. Recording an event on J.A.R.V.I.S.'s timeline is
 * LOW_REVERSIBLE (reversible via forget; auto only when automation is delegated,
 * else it prompts). Recalling the timeline is READ_ONLY. Content is redacted of
 * secrets and encrypted at rest (R-MEM-03/06).
 */
export function episodeMemoryTools(mem: EpisodicMemory): Tool[] {
  const record: Tool = {
    name: "memory.recordEpisode",
    description:
      "Record a notable event on J.A.R.V.I.S.'s timeline (what happened, when, why it mattered) so it can be recalled later. Reversible.",
    riskClass: "LOW_REVERSIBLE",
    action: "record event in episodic memory",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "one-line description of what happened" },
        kind: {
          type: "string",
          enum: ["observation", "action", "decision", "note", "milestone"],
          description: "observation | action | decision | note | milestone",
        },
        detail: { type: "string", description: "optional longer context (encrypted at rest)" },
        entity: { type: "string", description: "optional name of a known entity this event is about" },
        tags: { type: "array", items: { type: "string" }, description: "optional categorical labels" },
        importance: { type: "number", description: "0..1 — how much it matters (default 0.5)" },
      },
      required: ["summary"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as {
        summary: string;
        kind?: EpisodeKind;
        detail?: string;
        entity?: string;
        tags?: string[];
        importance?: number;
      };
      const e = await mem.record({
        summary: a.summary,
        ...(a.kind ? { kind: a.kind } : {}),
        ...(a.detail ? { detail: a.detail } : {}),
        ...(a.entity ? { entityName: a.entity } : {}),
        ...(a.tags ? { tags: a.tags } : {}),
        ...(a.importance !== undefined ? { importance: a.importance } : {}),
        provenance: "conversation (user asked me to remember this happened)",
      });
      return {
        ok: true,
        summary: `recorded ${e.kind}: ${e.summary}`,
        data: { id: e.id, kind: e.kind, occurred_at: e.occurred_at },
        rollback: async () => {
          await mem.forget(e.id);
        },
      };
    },
  };

  const recall: Tool = {
    name: "memory.recallEpisodes",
    description:
      "Recall J.A.R.V.I.S.'s timeline of past events. Filter by free-text query, kind, tag, linked entity, or a since-time; set semantic=true to recall by MEANING (nearest embeddings) rather than substring. Read-only.",
    riskClass: "READ_ONLY",
    action: "recall episodic timeline",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "free-text query (substring, or semantic when semantic=true)" },
        semantic: { type: "boolean", description: "recall by meaning (embeddings) instead of substring" },
        kind: { type: "string", enum: ["observation", "action", "decision", "note", "milestone"] },
        tag: { type: "string" },
        entity: { type: "string", description: "only events about this known entity" },
        since: { type: "string", description: "ISO instant — only events at or after this time" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as {
        query?: string;
        semantic?: boolean;
        kind?: EpisodeKind;
        tag?: string;
        entity?: string;
        since?: string;
        limit?: number;
      };
      // Semantic mode: recall by meaning (falls back to lexical inside semanticRecall
      // when no embedder is available, so it's always at least substring-good).
      const episodes = a.semantic && a.query
        ? await mem.semanticRecall(a.query, a.limit ?? 10)
        : await mem.recall({
            ...(a.query ? { query: a.query } : {}),
            ...(a.kind ? { kind: a.kind } : {}),
            ...(a.tag ? { tag: a.tag } : {}),
            ...(a.entity ? { entityName: a.entity } : {}),
            ...(a.since && !Number.isNaN(new Date(a.since).getTime()) ? { since: new Date(a.since) } : {}),
            ...(a.limit !== undefined ? { limit: a.limit } : {}),
          });
      if (episodes.length === 0) {
        return { ok: true, summary: "no matching events on the timeline", data: [], detail: "The timeline has no matching events." };
      }
      return {
        ok: true,
        summary: `${episodes.length} event(s) recalled${a.semantic ? " (by meaning)" : ""}`,
        data: episodes,
        detail: renderTimeline(episodes),
      };
    },
  };

  return [record, recall];
}

function renderTimeline(episodes: Episode[]): string {
  return episodes
    .map((e) => {
      const about = e.entity_name ? ` [about ${e.entity_name}]` : "";
      const tags = e.tags.length ? ` #${e.tags.join(" #")}` : "";
      return `${e.occurred_at} · ${e.kind}${about}: ${e.summary}${e.detail ? ` — ${e.detail}` : ""}${tags}`;
    })
    .join("\n");
}
