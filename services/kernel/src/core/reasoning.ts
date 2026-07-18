/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Deep-reasoning escalation (D-0048): decides when a conversational turn
 * warrants the `deep_reasoning` role instead of `fast_conversation`.
 *
 * Deliberately a TRANSPARENT, deterministic signal set — not a model call:
 * zero added latency, identical behavior for every provider behind the role
 * router (the "which LLM" question stays entirely in gateway config), and the
 * decision can be shown to the user verbatim ("why" is part of the result).
 * The caller can always override with an explicit mode; "auto" applies this
 * assessment. Escalation only ever changes the MODEL ROLE — never the privacy
 * class, policy gates, or approval requirements.
 */

export type ReasoningMode = "fast" | "deep";

export interface DepthAssessment {
  mode: ReasoningMode;
  /** human-readable explanation, surfaced to the user with the answer */
  why: string;
}

/** The user asked for deeper thought in so many words — always honored. */
const EXPLICIT_DEEP =
  /\b(think\s+(hard|harder|deeply|carefully|longer|it\s+through)|deep(ly)?\s+(reason\w*|think\w*|dive)|deep\s+reasoning|take\s+your\s+time|reason\s+(step\s+by\s+step|through|carefully)|step\s+by\s+step)\b/i;

/** Analytical/constructive work where reasoning depth visibly pays. */
const ANALYTICAL =
  /\b(analy[sz]e|architect\w*|design|redesign|prove|derive|optimi[sz]e|trade-?offs?|pros\s+and\s+cons|compare\s+and\s+contrast|root\s+cause|debug|refactor|strateg(y|ies|i[sz]e)|evaluate|implications?|feasib\w+|reconcile|synthesi[sz]e)\b/i;

/** Multi-part structure: fenced code, or a numbered list of 2+ items. */
const STRUCTURED = /```|(^|\n)\s*\d+[.)]\s.+(\n+\s*\d+[.)]\s.+)+/;

export function assessDepth(text: string, learnedTopics: string[] = []): DepthAssessment {
  const t = text.trim();
  if (EXPLICIT_DEEP.test(t)) return { mode: "deep", why: "you asked for deeper thought" };

  // Learned topics escalate ALONE: the user taught them (by instruction or by
  // repeated correction), so they outrank the generic two-signal rule.
  const lower = t.toLowerCase();
  const taught = learnedTopics.find((topic) =>
    new RegExp(`\\b${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower),
  );
  if (taught) return { mode: "deep", why: `you've taught me to think deeply about '${taught}'` };

  const signals: string[] = [];
  if (ANALYTICAL.test(t)) signals.push("analytical task");
  const questions = (t.match(/\?/g) ?? []).length;
  if (questions >= 3) signals.push(`${questions} questions in one turn`);
  if (t.length > 700) signals.push("long, detailed brief");
  if (STRUCTURED.test(t)) signals.push("multi-part or code content");

  // Deep is slower and (remotely) costlier — require two independent signals
  // unless the user asked explicitly. One signal alone stays fast, but the
  // signal is still reported so the user sees what was weighed.
  if (signals.length >= 2) return { mode: "deep", why: signals.join(" + ") };
  return {
    mode: "fast",
    why: signals[0] ? `routine turn (noted: ${signals[0]})` : "routine conversational turn",
  };
}

// ---------------------------------------------------------------------------
// Learning (D-0050): the assessment ADAPTS to the user over time — honestly.
// No opaque ML: two explainable channels, both stored as ordinary preferences
// (encrypted-capable, history-preserving, visible & deletable in the memory
// panel — the user can always see and edit what has been learned).
//   1. instruction — "always think deeply about X" → teach(topic)
//   2. correction  — the user explicitly forces deep on a turn the auto
//      assessment judged fast; salient terms from such turns accumulate, and a
//      term seen in ≥2 corrections is promoted to a learned topic.
// ---------------------------------------------------------------------------

export const DEEP_TOPICS_KEY = "reasoning_deep_topics";
export const DEEP_CANDIDATES_KEY = "reasoning_deep_candidates";
const PROMOTE_AT = 2;
const MAX_TOPICS = 50;

const STOPWORDS = new Set([
  "about", "above", "after", "again", "ahead", "along", "always", "analyze", "around",
  "because", "before", "being", "below", "between", "could", "deeply", "design", "every",
  "everything", "please", "really", "should", "since", "something", "their", "there", "these",
  "think", "thing", "things", "those", "through", "today", "under", "until", "where",
  "which", "while", "would", "wouldn't", "youre",
]);

function salientTerms(text: string): string[] {
  const terms = (text.toLowerCase().match(/[a-z][a-z0-9-]{4,}/g) ?? [])
    .filter((w) => !STOPWORDS.has(w));
  return [...new Set(terms)].slice(0, 8);
}

/** The slice of MemoryService the tuner needs (kept narrow for testability). */
export interface TunerStore {
  get(key: string): Promise<{ value: string } | null>;
  remember(input: {
    key: string;
    value: string;
    provenance: string;
    sensitivity?: "public" | "personal" | "private" | "secret";
  }): Promise<unknown>;
}

export class ReasoningTuner {
  constructor(private readonly store: TunerStore) {}

  private async readJson<T>(key: string, fallback: T): Promise<T> {
    try {
      const row = await this.store.get(key);
      return row ? (JSON.parse(row.value) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  /** Learned + instructed topics. Best-effort: never throws, [] on failure. */
  async topics(): Promise<string[]> {
    return this.readJson<string[]>(DEEP_TOPICS_KEY, []);
  }

  /** Learning-by-instruction: "always think deeply about <topic>". */
  async teach(topic: string, provenance = "user-instruction"): Promise<string[]> {
    const clean = topic.trim().toLowerCase();
    if (!clean) throw new Error("empty topic");
    const current = await this.topics();
    if (!current.includes(clean)) {
      const next = [...current, clean].slice(-MAX_TOPICS);
      await this.store.remember({
        key: DEEP_TOPICS_KEY,
        value: JSON.stringify(next),
        provenance,
      });
      return next;
    }
    return current;
  }

  async forget(topic: string): Promise<string[]> {
    const next = (await this.topics()).filter((t) => t !== topic.trim().toLowerCase());
    await this.store.remember({
      key: DEEP_TOPICS_KEY,
      value: JSON.stringify(next),
      provenance: "user-instruction",
    });
    return next;
  }

  /**
   * Learning-by-correction: called when the user explicitly forced deep on a
   * turn the auto assessment judged fast. Returns any topics newly promoted.
   */
  async recordCorrection(text: string): Promise<string[]> {
    const counts = await this.readJson<Record<string, number>>(DEEP_CANDIDATES_KEY, {});
    const topics = await this.topics();
    const promoted: string[] = [];
    for (const term of salientTerms(text)) {
      if (topics.includes(term)) continue;
      counts[term] = (counts[term] ?? 0) + 1;
      if (counts[term] >= PROMOTE_AT) {
        promoted.push(term);
        delete counts[term];
      }
    }
    await this.store.remember({
      key: DEEP_CANDIDATES_KEY,
      value: JSON.stringify(counts),
      provenance: "reasoning-correction",
    });
    if (promoted.length) {
      await this.store.remember({
        key: DEEP_TOPICS_KEY,
        value: JSON.stringify([...topics, ...promoted].slice(-MAX_TOPICS)),
        provenance: "learned-from-corrections",
      });
    }
    return promoted;
  }
}
