import type { ChatRequest, ChatResult, PrivacyClass } from "../gateway/schema.js";

/**
 * Memory-judgment layer (D-0075): the small, well-scoped places where a fast-model
 * *judgment* beats brittle string heuristics — deciding whether two names denote
 * the SAME real-world entity, whether two facts RESTATE the same thing, and what
 * the user actually wants deep reasoning ON. The user's steer (2026-07-20): "let
 * Jarvis look at the records and decide to merge or not rather than some code
 * fuzzy logic — do it with the fast model."
 *
 * Contract, non-negotiable:
 *  • BEST-EFFORT with a DETERMINISTIC FALLBACK (honesty rule + local-first). Every
 *    method returns `null` on ANY failure — no eligible provider (offline /
 *    LOCAL_ONLY with no local model), a timeout, a parse error, or the feature
 *    switched off — and the caller then uses its existing code path. The judge
 *    never throws into a memory write and never blocks it.
 *  • PRIVACY-RESPECTING: the caller passes the privacy class derived from the
 *    sensitivity of the rows involved. Private/secret memory → LOCAL_ONLY, which
 *    the gateway keeps on-device (a remote-only fast model then simply yields the
 *    deterministic fallback). Public/personal → STANDARD, the same class under
 *    which those facts already reach the brain during conversation.
 *  • It only ever proposes MERGES/RESOLUTIONS. Every merge supersedes-with-history
 *    (walkable, reversible); nothing is hard-deleted on a model's say-so.
 */

/** Minimal gateway surface the judge needs (keeps it unit-testable with a stub). */
export interface JudgeGateway {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult>;
}

export interface EntityCandidate {
  name: string;
  kind: string;
  attributes?: string;
  facts?: string[];
}

export interface FactForMerge {
  idx: number;
  text: string;
}

export interface MergeGroup {
  /** index of the fact to KEEP (clearest/most complete) */
  keep: number;
  /** indices of facts that RESTATE the kept one and should be superseded */
  supersede: number[];
}

export interface EntityForMerge {
  idx: number;
  kind: string;
  facts: string[];
}

export interface EntityMergeGroup {
  /** index of the entity to KEEP (best-described) */
  keep: number;
  /** indices of same-named entities that are the SAME real-world thing to fold in */
  merge: number[];
}

export interface MemoryJudge {
  /**
   * Does the newly-mentioned entity denote the SAME real-world thing as one of the
   * candidates? Candidates may span DIFFERENT kinds (across stateless sessions the
   * model sometimes labels the same thing inconsistently). Returns the matched
   * candidate's INDEX (unambiguous even when candidates share a name across kinds),
   * or null for "new / none / unsure". Best-effort → null on any failure.
   */
  resolveEntity(
    subject: { name: string; kind: string; attributes?: string },
    candidates: EntityCandidate[],
    privacy: PrivacyClass,
  ): Promise<{ sameAs: number | null; reason: string } | null>;

  /**
   * Which of an entity's active facts RESTATE the same information and should be
   * merged (keeping the clearest)? Returns merge groups by index, or null on
   * failure. An empty array means "considered, nothing to merge" (distinct from
   * null = "couldn't judge, fall back").
   */
  mergeFacts(
    entity: string,
    facts: FactForMerge[],
    privacy: PrivacyClass,
  ): Promise<MergeGroup[] | null>;

  /**
   * Given several entities that share a NAME but were stored under different KINDS,
   * which refer to the SAME real-world thing and should be merged (keeping the
   * best-described)? Genuinely different things that merely share a name (Mercury
   * the planet vs the element) must NOT be merged. Returns groups by index, or null
   * on failure; empty array = "considered, nothing to merge".
   */
  mergeEntities(
    name: string,
    entities: EntityForMerge[],
    privacy: PrivacyClass,
  ): Promise<EntityMergeGroup[] | null>;

  /**
   * The specific subject-matter the user wants deep reasoning on, from a turn they
   * explicitly forced deep. Returns short lowercase topic terms, or null on
   * failure. Deliberately strips filler ("quick", "one-line", "intuition").
   */
  extractTopics(text: string, privacy: PrivacyClass): Promise<string[] | null>;
}

/** LOCAL_ONLY if anything involved is private/secret; else STANDARD (the class
 *  under which public/personal facts already reach the conversation brain). */
export function privacyForSensitivities(sens: (string | undefined)[]): PrivacyClass {
  return sens.some((s) => s === "private" || s === "secret") ? "LOCAL_ONLY" : "STANDARD";
}

/**
 * Judge prompt templates (D-0079 Slice L1a): the system prompts below are
 * EXPERIMENTABLE SURFACE for the Night Lab, so they live as named `template`
 * prompts in the prompts registry (versioned, user-editable, lab-editable)
 * with these code constants as the seeded defaults AND the permanent fallback.
 * Resolution is best-effort at call time: a registry failure, a missing row, or
 * no resolver at all → the code constant. The registry can therefore never
 * break a memory write (same non-negotiable contract as the judge itself).
 */
export const JUDGE_TEMPLATES = {
  "judge-entity-resolution":
    "You are J.A.R.V.I.S.'s memory entity-resolution subsystem. A new mention has arrived; " +
    "decide whether it denotes the SAME real-world thing as one already known. Be CONSERVATIVE: " +
    "say SAME only when you are confident they are the identical real-world entity — e.g. a short " +
    "name vs its full name ('Pepper' ⇄ 'Pepper Potts'), or the same object described two ways " +
    "('Mark 42' ⇄ 'the Mark 42 suit'). Candidates may carry a DIFFERENT kind than the new mention: " +
    "the same real-world thing is sometimes labelled inconsistently ('arc reactor' as a 'thing' or a " +
    "'project') — that is still the SAME. But a shared NAME across genuinely different things " +
    "('Mercury' the planet vs the element vs the Roman god) is NOT the same. Reply with ONLY JSON: " +
    '{"sameAs": <candidate index (integer) or null>, "reason": "<short>"}.',
  "judge-entity-consolidation":
    "You consolidate a person's memory during sleep. These entities all share the NAME below but " +
    "were stored under DIFFERENT kinds — across stateless sessions the model sometimes labels the " +
    "same real-world thing inconsistently (e.g. 'arc reactor' as both a 'thing' and a 'project'). " +
    "Decide which refer to the SAME real-world thing and should be merged, keeping the best-described " +
    "one. Do NOT merge entities that are genuinely DIFFERENT things merely sharing a name ('Mercury' " +
    "the planet vs the element vs the Roman god). When unsure, do not merge. Reply with ONLY JSON: " +
    '{"merges": [{"keep": <index>, "merge": [<index>, ...]}, ...]} — empty if nothing to merge.',
  "judge-fact-consolidation":
    "You consolidate a person's long-term memory during sleep. Given the facts currently known " +
    "about ONE entity, identify groups that RESTATE the same information (possibly reworded, e.g. " +
    "'runs on a palladium core' and 'uses a palladium core'), which should be merged by keeping the " +
    "single clearest/most complete statement. Do NOT merge facts that add DIFFERENT information, " +
    "even about the same entity (different attributes, numbers, events). When unsure, do not merge. " +
    'Reply with ONLY JSON: {"merges": [{"keep": <index>, "supersede": [<index>, ...]}, ...]} — empty if nothing to merge.',
  "judge-agenda-freshness":
    "You are J.A.R.V.I.S.'s agenda-freshness check, run just before autonomous time. Each agenda item " +
    "below was written at its createdAt; the CHANGES list is what actually happened since (memory " +
    "updates, actions, decisions — newest context wins over older intent). Mark an item STALE only " +
    "when the changes show it is already satisfied, explicitly contradicted, or clearly overtaken by " +
    "events. When unsure, it is NOT stale (acting on a valid item matters more than skipping a " +
    'doubtful one). Reply with ONLY JSON: {"stale": [{"idx": <index>, "reason": "<short>"}, ...]} — empty list if all items remain valid.',
  "judge-topic-extraction":
    "The user just asked J.A.R.V.I.S. to think more deeply about their message. First judge whether the " +
    "question's SUBJECT inherently warrants deep reasoning — technical, analytical, multi-factor, or " +
    "consequential subject-matter (e.g. reactor stability, orbital mechanics, drug interactions). A " +
    "routine everyday question (weather, lunch, what day it is, whether to take a walk) does NOT " +
    "qualify even though the user chose deep this time — that choice is a preference of the moment, " +
    "not evidence about a topic; return an empty list for it. If the subject qualifies, extract it as " +
    "1-3 short lowercase topic terms (single distinctive words or two-word phrases, e.g. 'palladium', " +
    "'orbital mechanics', 'metallurgy'). IGNORE filler and meta words like 'quick', 'one-line', " +
    "'intuition', 'explain', 'give me'. Return the SUBJECT DOMAIN — a field, system, material, or " +
    "phenomenon — never an activity, method, or process word ('tuning', 'planning', 'testing', " +
    "'setup', 'review'): for 'how would you approach tuning the containment field' the topic is " +
    "'containment field', not 'tuning'. If the only candidate is an activity word, or there is no " +
    "substantive topic, return an empty list. " +
    'Reply with ONLY JSON: {"topics": ["...", ...]}.',
} as const;

export type JudgeTemplateName = keyof typeof JUDGE_TEMPLATES;

/** Resolves the active registry override for a judge template, or null → default. */
export type JudgeTemplateResolver = (name: JudgeTemplateName) => Promise<string | null>;

/**
 * Idempotent boot-seed: register each judge template in the prompts registry
 * when absent, so the templates are visible + versionable (and the Night Lab
 * can supersede them via the normal `prompts.set` path). Existing rows —
 * including user or lab edits — are never touched. Best-effort: a registry
 * failure only means the code-constant fallback keeps serving.
 */
export async function seedJudgeTemplates(registry: {
  get(name: string, kind: "template"): Promise<{ content: string } | null>;
  set(input: { name: string; kind: "template"; content: string; provenance?: string }): Promise<unknown>;
}): Promise<void> {
  for (const [name, content] of Object.entries(JUDGE_TEMPLATES)) {
    try {
      const existing = await registry.get(name, "template");
      if (!existing) await registry.set({ name, kind: "template", content, provenance: "builtin-seed" });
    } catch {
      /* best-effort — fallback constants still serve */
    }
  }
}

/** Pull a JSON object/array out of a model reply, tolerating code fences and
 *  surrounding prose. Returns null if nothing parses. */
function parseJson<T>(text: string): T | null {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  // try the whole thing, then the first {...} or [...] span
  for (const candidate of [fenced, sliceSpan(fenced, "{", "}"), sliceSpan(fenced, "[", "]")]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}
function sliceSpan(s: string, open: string, close: string): string | null {
  const a = s.indexOf(open);
  const b = s.lastIndexOf(close);
  return a >= 0 && b > a ? s.slice(a, b + 1) : null;
}

/**
 * The real judge, backed by the gateway's `fast_conversation` role. Off → every
 * method returns null (caller falls back). All calls are wrapped so no provider
 * error ever escapes.
 */
export class GatewayMemoryJudge implements MemoryJudge {
  constructor(
    private readonly gateway: JudgeGateway,
    private readonly opts: {
      /** live gate — reads the `memory.llmJudgment` setting; false → all null */
      enabled?: () => Promise<boolean> | boolean;
      /** hard cap so a stuck provider can't stall a memory write (default 15s) */
      timeoutMs?: number;
      /** optional prompt-template override source (D-0079: the prompts registry).
       *  Best-effort: null/throw → the JUDGE_TEMPLATES code constant. */
      templates?: JudgeTemplateResolver;
    } = {},
  ) {}

  private async enabled(): Promise<boolean> {
    try {
      return this.opts.enabled ? Boolean(await this.opts.enabled()) : true;
    } catch {
      return false;
    }
  }

  /** Active template override, else the shipped default — never throws. */
  private async template(name: JudgeTemplateName): Promise<string> {
    if (this.opts.templates) {
      try {
        const t = await this.opts.templates(name);
        if (t && t.trim().length > 0) return t;
      } catch {
        /* registry unavailable → default */
      }
    }
    return JUDGE_TEMPLATES[name];
  }

  private async ask<T>(
    system: string,
    user: string,
    privacy: PrivacyClass,
    source: string,
  ): Promise<T | null> {
    if (!(await this.enabled())) return null;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.opts.timeoutMs ?? 15000);
    try {
      const res = await this.gateway.chat(
        {
          role: "fast_conversation",
          privacyClass: privacy,
          source,
          maxTokens: 500,
          messages: [
            { role: "system", content: system },
            { role: "user", content: [{ type: "text", text: user }] },
          ],
        },
        ac.signal,
      );
      return parseJson<T>(res.text);
    } catch {
      // no eligible provider / offline / timeout / adapter error → fall back
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async resolveEntity(
    subject: { name: string; kind: string; attributes?: string },
    candidates: EntityCandidate[],
    privacy: PrivacyClass,
  ): Promise<{ sameAs: number | null; reason: string } | null> {
    if (candidates.length === 0) return { sameAs: null, reason: "no similar entity known" };
    const system = await this.template("judge-entity-resolution");
    const user = JSON.stringify({
      newMention: { name: subject.name, kind: subject.kind, attributes: subject.attributes ?? "" },
      knownCandidates: candidates.map((c, i) => ({
        index: i,
        name: c.name,
        kind: c.kind,
        attributes: c.attributes ?? "",
        facts: (c.facts ?? []).slice(0, 4),
      })),
    });
    const out = await this.ask<{ sameAs: number | null; reason?: string }>(
      system,
      user,
      privacy,
      "memory-entity-resolution",
    );
    if (!out) return null;
    const idx = typeof out.sameAs === "number" ? out.sameAs : null;
    if (idx == null) return { sameAs: null, reason: out.reason ?? "distinct entity" };
    // must be a valid candidate index, else treat as no-match
    return idx >= 0 && idx < candidates.length
      ? { sameAs: idx, reason: out.reason ?? "same entity" }
      : { sameAs: null, reason: "no candidate matched" };
  }

  async mergeEntities(
    name: string,
    entities: EntityForMerge[],
    privacy: PrivacyClass,
  ): Promise<EntityMergeGroup[] | null> {
    if (entities.length < 2) return [];
    const system = await this.template("judge-entity-consolidation");
    const user = JSON.stringify({
      name,
      entities: entities.map((e) => ({ index: e.idx, kind: e.kind, facts: e.facts.slice(0, 5) })),
    });
    const out = await this.ask<{ merges?: EntityMergeGroup[] }>(system, user, privacy, "memory-entity-consolidation");
    if (!out) return null;
    const valid = new Set(entities.map((e) => e.idx));
    const groups: EntityMergeGroup[] = [];
    for (const g of out.merges ?? []) {
      if (!valid.has(g.keep)) continue;
      const merge = (g.merge ?? []).filter((i) => valid.has(i) && i !== g.keep);
      if (merge.length) groups.push({ keep: g.keep, merge: [...new Set(merge)] });
    }
    return groups;
  }

  async mergeFacts(
    entity: string,
    facts: FactForMerge[],
    privacy: PrivacyClass,
  ): Promise<MergeGroup[] | null> {
    if (facts.length < 2) return [];
    const system = await this.template("judge-fact-consolidation");
    const user = JSON.stringify({
      entity,
      facts: facts.map((f) => ({ index: f.idx, statement: f.text })),
    });
    const out = await this.ask<{ merges?: MergeGroup[] }>(system, user, privacy, "memory-fact-consolidation");
    if (!out) return null;
    const valid = new Set(facts.map((f) => f.idx));
    const groups: MergeGroup[] = [];
    for (const g of out.merges ?? []) {
      if (!valid.has(g.keep)) continue;
      const supersede = (g.supersede ?? []).filter((i) => valid.has(i) && i !== g.keep);
      if (supersede.length) groups.push({ keep: g.keep, supersede: [...new Set(supersede)] });
    }
    return groups;
  }

  /**
   * Agenda freshness (D-0077): a heartbeat is about to act on to-do items that
   * were written EARLIER — decide whether anything that happened SINCE each item
   * was written (episodes, updates, corrections) makes it stale: already done,
   * contradicted, or overtaken by events. NOT on the MemoryJudge interface —
   * only the scheduler uses it (via a closure), so entity-memory fakes stay
   * untouched. Best-effort → null on any failure (caller proceeds as today).
   * Returns ONLY the stale items; [] = all still valid.
   */
  async assessAgendaFreshness(
    items: { idx: number; what: string; why?: string; createdAt: string }[],
    changes: { at: string; text: string }[],
    privacy: PrivacyClass,
  ): Promise<{ idx: number; reason: string }[] | null> {
    if (items.length === 0) return [];
    if (changes.length === 0) return []; // nothing happened since — nothing can be stale
    const system = await this.template("judge-agenda-freshness");
    const user = JSON.stringify({
      agendaItems: items.map((i) => ({ index: i.idx, what: i.what, why: i.why ?? "", createdAt: i.createdAt })),
      changesSince: changes.slice(0, 15),
    });
    const out = await this.ask<{ stale?: { idx: number; reason?: string }[] }>(
      system,
      user,
      privacy,
      "agenda-freshness",
    );
    if (!out) return null;
    const valid = new Set(items.map((i) => i.idx));
    return (out.stale ?? [])
      .filter((s) => valid.has(s.idx))
      .map((s) => ({ idx: s.idx, reason: (s.reason ?? "may be outdated").slice(0, 200) }));
  }

  async extractTopics(text: string, privacy: PrivacyClass): Promise<string[] | null> {
    const system = await this.template("judge-topic-extraction");
    const out = await this.ask<{ topics?: string[] }>(system, text.slice(0, 2000), privacy, "reasoning-topic-extraction");
    if (!out) return null;
    return (out.topics ?? [])
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length >= 3 && t.length <= 40)
      .slice(0, 3);
  }
}
