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

export interface MemoryJudge {
  /**
   * Does the newly-mentioned entity denote the SAME real-world thing as one of the
   * (similarly-named) candidates? Returns the matched candidate's name, or null for
   * "new / none / unsure". Best-effort → null on any failure.
   */
  resolveEntity(
    subject: { name: string; kind: string; attributes?: string },
    candidates: EntityCandidate[],
    privacy: PrivacyClass,
  ): Promise<{ sameAs: string | null; reason: string } | null>;

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
    } = {},
  ) {}

  private async enabled(): Promise<boolean> {
    try {
      return this.opts.enabled ? Boolean(await this.opts.enabled()) : true;
    } catch {
      return false;
    }
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
  ): Promise<{ sameAs: string | null; reason: string } | null> {
    if (candidates.length === 0) return { sameAs: null, reason: "no similar entity known" };
    const system =
      "You are J.A.R.V.I.S.'s memory entity-resolution subsystem. A new mention has arrived; " +
      "decide whether it denotes the SAME real-world thing as one already known. Be CONSERVATIVE: " +
      "say SAME only when you are confident they are the identical real-world entity — e.g. a short " +
      "name vs its full name ('Pepper' ⇄ 'Pepper Potts'), or the same object described two ways " +
      "('Mark 42' ⇄ 'the Mark 42 suit'). Two DIFFERENT specific things that merely share a category " +
      'are NOT the same. Reply with ONLY JSON: {"sameAs": <exact candidate name or null>, "reason": "<short>"}.';
    const user = JSON.stringify({
      newMention: { name: subject.name, kind: subject.kind, attributes: subject.attributes ?? "" },
      knownCandidates: candidates.map((c) => ({
        name: c.name,
        kind: c.kind,
        attributes: c.attributes ?? "",
        facts: (c.facts ?? []).slice(0, 4),
      })),
    });
    const out = await this.ask<{ sameAs: string | null; reason?: string }>(
      system,
      user,
      privacy,
      "memory-entity-resolution",
    );
    if (!out) return null;
    if (out.sameAs == null) return { sameAs: null, reason: out.reason ?? "distinct entity" };
    // the model must pick an EXACT candidate name (case-insensitive); otherwise treat as no-match
    const match = candidates.find((c) => c.name.toLowerCase() === String(out.sameAs).toLowerCase());
    return match ? { sameAs: match.name, reason: out.reason ?? "same entity" } : { sameAs: null, reason: "no candidate matched" };
  }

  async mergeFacts(
    entity: string,
    facts: FactForMerge[],
    privacy: PrivacyClass,
  ): Promise<MergeGroup[] | null> {
    if (facts.length < 2) return [];
    const system =
      "You consolidate a person's long-term memory during sleep. Given the facts currently known " +
      "about ONE entity, identify groups that RESTATE the same information (possibly reworded, e.g. " +
      "'runs on a palladium core' and 'uses a palladium core'), which should be merged by keeping the " +
      "single clearest/most complete statement. Do NOT merge facts that add DIFFERENT information, " +
      "even about the same entity (different attributes, numbers, events). When unsure, do not merge. " +
      'Reply with ONLY JSON: {"merges": [{"keep": <index>, "supersede": [<index>, ...]}, ...]} — empty if nothing to merge.';
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

  async extractTopics(text: string, privacy: PrivacyClass): Promise<string[] | null> {
    const system =
      "The user just asked J.A.R.V.I.S. to think more deeply about their message. Extract the SPECIFIC " +
      "subject-matter they want deep reasoning on, as 1-3 short lowercase topic terms (single distinctive " +
      "words or two-word phrases, e.g. 'palladium', 'orbital mechanics', 'metallurgy'). IGNORE filler and " +
      "meta words like 'quick', 'one-line', 'intuition', 'explain', 'give me'. If there is no substantive " +
      'topic, return an empty list. Reply with ONLY JSON: {"topics": ["...", ...]}.';
    const out = await this.ask<{ topics?: string[] }>(system, text.slice(0, 2000), privacy, "reasoning-topic-extraction");
    if (!out) return null;
    return (out.topics ?? [])
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length >= 3 && t.length <= 40)
      .slice(0, 3);
  }
}
