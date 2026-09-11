import type { MemoryService, Preference } from "../../memory/memory.js";
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

/** How many ranked preferences a filtered recall returns before "N more" (E-04). */
export const PREFERENCE_RECALL_CAP = 12;

const STOP = new Set(["the", "and", "for", "what", "which", "our", "your", "is", "are", "of", "to", "in", "on", "at", "my", "a", "an"]);

/** Content tokens of a query: words of three or more letters/digits, minus the
 *  first-person filler that carries no meaning ("my gym day" → gym, day). */
export function contentTokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

const keyTokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

/**
 * Longitude-XL E-04 (2026-09-11): the old substring filter could hand the
 * agent the whole store — "gym day" matched every key containing "day" (26
 * rows), one call returned 94. Rank by WHOLE-TOKEN overlap between the query
 * and the key (values count half), exact-key matches first, and cap the
 * result; the caller says how many more there are.
 */
export function rankPreferences(all: Preference[], query: string): { ranked: Preference[]; total: number } {
  const q = query.trim().toLowerCase();
  const qToks = new Set(contentTokens(q));
  if (!qToks.size) return { ranked: [], total: 0 };
  const scored = all
    .map((p) => {
      const kt = keyTokens(p.key);
      const vt = keyTokens(p.value);
      let score = 0;
      for (const t of qToks) {
        if (kt.has(t)) score += 2;
        else if (vt.has(t)) score += 1;
      }
      // an exact key (all query tokens ⊆ key tokens and no extras) ranks first
      const exact = [...qToks].every((t) => kt.has(t)) && [...kt].every((t) => qToks.has(t) || STOP.has(t));
      if (exact) score += 10;
      // every query token present in the key: strong match
      else if ([...qToks].every((t) => kt.has(t))) score += 4;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.p.updated_at < b.p.updated_at ? 1 : -1));
  return { ranked: scored.map((x) => x.p), total: scored.length };
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
      "against keys and values (ranked by word overlap; exact keys first; capped). Use when asked about the user's preferences, habits, orders, " +
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
      let rows = all;
      let total = all.length;
      if (q) {
        const r = rankPreferences(all, q);
        rows = r.ranked.slice(0, PREFERENCE_RECALL_CAP);
        total = r.total;
      }
      const lines = rows.map((p) => {
        const guarded = p.sensitivity === "private" || p.sensitivity === "secret";
        const value = guarded ? "[value withheld — private]" : p.value;
        return `${p.key} = ${value}${p.pinned ? " (pinned)" : ""}`;
      });
      const more = total > rows.length ? `… ${total - rows.length} more match loosely — narrow the query to see them` : "";
      // G-05 fallback: first-person facts that live in entity memory.
      const extra = q && entities ? await entityFactsFor(entities, q) : [];
      const detail = [
        lines.length ? lines.join("\n") : "no stored preferences match",
        more,
        extra.length ? "Also held as ENTITY facts (first-person facts the agent filed on an entity, not preferences):\n" + extra.join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        ok: true,
        summary: `${rows.length}${total > rows.length ? ` of ${total}` : ""} preference(s)${q ? ` matching '${q}'` : ""}${extra.length ? ` + ${extra.length} entity fact(s)` : ""}`,
        data: { count: rows.length, total, entityFacts: extra.length },
        detail,
      };
    },
  };
}

/** First-person facts that live on an entity named by the query (whole
 *  subject, then each content word) or on the user's own entity. */
export async function entityFactsFor(entities: EntityMemory, q: string, cap = 5): Promise<string[]> {
  const extra: string[] = [];
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
      if (extra.length >= cap) return;
    }
  };
  const subject = q.replace(/^(my|our)\s+/, "").trim();
  const names = [...new Set([subject, ...contentTokens(subject)].filter(Boolean))];
  for (const [i, name] of names.entries()) {
    if (extra.length >= cap) break;
    await consider(name, i > 0);
  }
  for (const self of SELF_NAMES) {
    if (extra.length >= cap) break;
    await consider(self, true);
  }
  return extra;
}
