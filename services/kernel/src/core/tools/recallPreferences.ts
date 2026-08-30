import type { MemoryService } from "../../memory/memory.js";
import type { Tool, ToolResult } from "../tools.js";

interface RecallArgs {
  query?: string;
}

/** Machinery keys served by their own tools/routes — noise for recall, and
 *  merging or listing them here would confuse "what do you know about me". */
const INTERNAL_PREFIX = /^(reasoning_|gateway_|a2ui_|lab_)/;

/**
 * Longitude finding #2 (docs/verification/LONGITUDE_2026-08-30.md): agents
 * could WRITE preferences (`memory.remember`) but nothing on the agent tool
 * surface could read one back — stored-correct values were unreachable in
 * recall ("coffee 0/14"). This closes the read path. READ_ONLY, auto-runs.
 *
 * Sensitivity contract mirrors `recentForContext`: public/personal values are
 * returned; private/secret rows are listed by key with the value withheld
 * (the memory panel or an explicit user ask is the path to those).
 */
export function recallPreferencesTool(memory: MemoryService): Tool {
  return {
    name: "memory.recallPreferences",
    description:
      "Recall stored user preferences (key/value), optionally filtered by a query matched " +
      "against keys and values. Use when asked about the user's preferences, habits, orders, " +
      "or 'what do you know about me'. Private values are withheld (key listed).",
    riskClass: "READ_ONLY",
    action: "read stored preferences from local memory",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "optional case-insensitive filter" },
      },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { query } = (args ?? {}) as RecallArgs;
      const q = query?.trim().toLowerCase();
      const all = (await memory.list()).filter((p) => !INTERNAL_PREFIX.test(p.key));
      const rows = q
        ? all.filter(
            (p) =>
              p.key.toLowerCase().includes(q) ||
              p.value.toLowerCase().includes(q) ||
              q.split(/\s+/).some((w) => w.length >= 3 && (p.key.toLowerCase().includes(w) || p.value.toLowerCase().includes(w))),
          )
        : all;
      const lines = rows.map((p) => {
        const guarded = p.sensitivity === "private" || p.sensitivity === "secret";
        const value = guarded ? "[value withheld — private]" : p.value;
        return `${p.key} = ${value}${p.pinned ? " (pinned)" : ""}`;
      });
      return {
        ok: true,
        summary: `${rows.length} preference(s)${q ? ` matching '${q}'` : ""}`,
        data: { count: rows.length },
        detail: lines.length ? lines.join("\n") : "no stored preferences match",
      };
    },
  };
}
