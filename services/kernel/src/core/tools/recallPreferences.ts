import type { MemoryService } from "../../memory/memory.js";
import type { EntityMemory } from "../../memory/entities.js";
import type { Tool, ToolResult } from "../tools.js";

interface RecallArgs {
  query?: string;
}

/** Machinery keys served by their own tools/routes — noise for recall, and
 *  merging or listing them here would confuse "what do you know about me". */
const INTERNAL_PREFIX = /^(reasoning_|gateway_|a2ui_|lab_)/;

/** Entities the agent has used to mean the user themself (Longitude-XL G-05). */
const SELF_NAMES = ["user", "me", "myself", "owner", "the user"];

/** Content tokens of a query: words of three or more letters/digits, minus the
 *  first-person filler that carries no meaning ("my gym day" → gym, day). */
function contentTokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !["the", "and", "for", "what", "which", "our", "your"].includes(w));
}

/**
 * Longitude finding #2 (docs/verification/LONGITUDE_2026-08-30.md): agents
 * could WRITE preferences (`memory.remember`) but nothing on the agent tool
 * surface could read one back — stored-correct values were unreachable in
 * recall ("coffee 0/14"). This closes the read path. READ_ONLY, auto-runs.
 *
 * Longitude-XL G-05 (2026-09-11): the agent sometimes stores a first-person
 * preference as an ENTITY fact ("my bike colour is olive" on a thing named
 * `bike`, "my gym day is friday" on an entity named `user`), and a
 * preference-only read then answers "not found" for a value the store holds.
 * When an entity memory is given, a filtered recall also surfaces facts held
 * on an entity named like the query and on the user's own entity, labelled as
 * entity facts so the agent knows where they live.
 *
 * Sensitivity contract mirrors `recentForContext`: public/personal values are
 * returned; private/secret rows are listed by key with the value withheld
 * (the memory panel or an explicit user ask is the path to those).
 */
export function recallPreferencesTool(memory: MemoryService, entities?: EntityMemory): Tool {
  return {
    name: "memory.recallPreferences",
    description:
      "Recall stored user preferences (key/value), optionally filtered by a query matched " +
      "against keys and values. Use when asked about the user's preferences, habits, orders, " +
      "or 'what do you know about me'. Also reports first-person facts held in entity memory " +
      "(on the user, or on a thing named like the query). Private values are withheld (key listed).",
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
      // G-05 fallback: first-person facts that live in entity memory.
      const extra: string[] = [];
      if (q && entities) {
        const toks = contentTokens(q);
        const seen = new Set<string>();
        const consider = async (name: string, requireToken: boolean) => {
          let r: Awaited<ReturnType<EntityMemory["recall"]>> = null;
          try {
            r = await entities.recall(name);
          } catch {
            r = null;
          }
          if (!r) return;
          for (const f of r.facts) {
            const s = f.statement.toLowerCase();
            const sensitive = f.sensitivity === "private" || f.sensitivity === "secret";
            if (requireToken && !toks.some((t) => s.includes(t))) continue;
            if (sensitive || seen.has(f.id)) continue;
            seen.add(f.id);
            extra.push(`${r.entity.name}: ${f.statement}`);
            if (extra.length >= 5) return;
          }
        };
        // the thing named by the whole subject ("study plant"), then by each of
        // its content words ("bike colour" → the thing `bike`), then the user
        const subject = q.replace(/^(my|our)\s+/, "").trim();
        const names = [...new Set([subject, ...contentTokens(subject)].filter(Boolean))];
        for (const [i, name] of names.entries()) {
          if (extra.length >= 5) break;
          await consider(name, i > 0);
        }
        for (const self of SELF_NAMES) {
          if (extra.length >= 5) break;
          await consider(self, true);
        }
      }
      const detail = [
        lines.length ? lines.join("\n") : "no stored preferences match",
        extra.length ? "Also held as ENTITY facts (first-person facts the agent filed on an entity, not preferences):\n" + extra.join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        ok: true,
        summary: `${rows.length} preference(s)${q ? ` matching '${q}'` : ""}${extra.length ? ` + ${extra.length} entity fact(s)` : ""}`,
        data: { count: rows.length, entityFacts: extra.length },
        detail,
      };
    },
  };
}
