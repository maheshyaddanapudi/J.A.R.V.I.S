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

/** Closed categorical reasons — journaled (0015) for the sleep cycle; never
 *  free text, so the journal carries no conversation content. */
export type DepthReason =
  | "explicit_ask"
  | "learned_topic"
  | "signals"
  | "single_signal"
  | "routine"
  | "override"
  | "correction_promoted"
  | "downgrade_ineligible";

export interface DepthAssessment {
  mode: ReasoningMode;
  /** human-readable explanation, surfaced to the user with the answer */
  why: string;
  /** categorical reason for the decision journal */
  reason: DepthReason;
}

/** The user asked for deeper thought in so many words — always honored. */
const EXPLICIT_DEEP =
  /\b(think\s+(hard|harder|deeply|carefully|longer|it\s+through)|deep(ly)?\s+(reason\w*|think\w*|dive)|deep\s+reasoning|take\s+your\s+time|reason\s+(step\s+by\s+step|through|carefully)|step\s+by\s+step)\b/i;

/** Analytical/constructive work where reasoning depth visibly pays. */
const ANALYTICAL =
  /\b(analy[sz]e|architect\w*|design|redesign|prove|derive|optimi[sz]e|trade-?offs?|pros\s+and\s+cons|compare\s+and\s+contrast|root\s+cause|debug|refactor|strateg(y|ies|i[sz]e)|evaluate|implications?|feasib\w+|reconcile|synthesi[sz]e)\b/i;

/** Multi-part structure: fenced code, or a numbered list of 2+ items. */
const STRUCTURED = /```|(^|\n)\s*\d+[.)]\s.+(\n+\s*\d+[.)]\s.+)+/;

export function assessDepth(
  text: string,
  learnedTopics: string[] = [],
  /** how many independent signals auto-escalate (default 2; the sleep cycle
   *  may adjust it to 1 within bounds — D-0051 autotune, user override wins) */
  signalThreshold = 2,
): DepthAssessment {
  const t = text.trim();
  if (EXPLICIT_DEEP.test(t))
    return { mode: "deep", why: "you asked for deeper thought", reason: "explicit_ask" };

  // Learned topics escalate ALONE: the user taught them (by instruction or by
  // repeated correction), so they outrank the generic signal rule.
  const lower = t.toLowerCase();
  const taught = learnedTopics.find((topic) =>
    new RegExp(`\\b${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower),
  );
  if (taught)
    return {
      mode: "deep",
      why: `you've taught me to think deeply about '${taught}'`,
      reason: "learned_topic",
    };

  const signals: string[] = [];
  if (ANALYTICAL.test(t)) signals.push("analytical task");
  const questions = (t.match(/\?/g) ?? []).length;
  if (questions >= 3) signals.push(`${questions} questions in one turn`);
  if (t.length > 700) signals.push("long, detailed brief");
  if (STRUCTURED.test(t)) signals.push("multi-part or code content");

  // Deep is slower and (remotely) costlier — require signalThreshold
  // independent signals unless the user asked explicitly. A sub-threshold
  // signal stays fast but is still reported so the user sees what was weighed.
  const threshold = signalThreshold <= 1 ? 1 : 2;
  if (signals.length >= threshold)
    return {
      mode: "deep",
      why: signals.join(" + "),
      reason: signals.length >= 2 ? "signals" : "single_signal",
    };
  return {
    mode: "fast",
    why: signals[0] ? `routine turn (noted: ${signals[0]})` : "routine conversational turn",
    reason: "routine",
  };
}

// ---------------------------------------------------------------------------
// Learning (D-0050): the assessment ADAPTS to the user over time — honestly.
// No opaque ML: two explainable channels, both stored as ordinary preferences
// (encrypted-capable, history-preserving, visible & deletable in the memory
// panel — the user can always see and edit what has been learned).
//   1. instruction — "always think deeply about X" → teach(topic)
//   2. correction  — the user explicitly forces deep on a turn the auto
//      assessment judged fast; the topic of such turns accumulates, and a
//      term seen in ≥2 corrections is promoted to a learned topic — but only
//      once the judgment model has confirmed it at least once (D-0080 C2,
//      R-MEM-10): the deterministic fallback extractor may ACCUMULATE, never
//      PROMOTE. Longitude-XL showed the fallback learning six filler words
//      during a 180-day dead-model window — learning worse than not learning.
// ---------------------------------------------------------------------------

export const DEEP_TOPICS_KEY = "reasoning_deep_topics";
export const DEEP_CANDIDATES_KEY = "reasoning_deep_candidates";
export const AUTOTUNE_KEY = "reasoning_autotune";
const PROMOTE_AT = 2;
const MAX_TOPICS = 50;
/** bound on the candidate ledger — an outage's fallback terms must not grow it
 *  without limit; unjudged low-count entries are dropped first */
const MAX_CANDIDATES = 200;

/** A not-yet-promoted deep-topic candidate: `count` = corrections that
 *  mentioned it, `judged` = how many of those the judgment model confirmed. */
interface Candidate {
  count: number;
  judged: number;
}

/** Outcome of one learning-by-correction turn. */
export interface CorrectionOutcome {
  /** topics newly promoted to always-deep this turn */
  promoted: string[];
  /** terms accumulated (or advanced) this turn without promotion */
  noted: string[];
  /** true when no judgment model confirmed the extraction: the terms were
   *  accumulated by the deterministic fallback and cannot promote until a
   *  judge confirms them — the caller says so instead of learning silently */
  deferred: boolean;
}

/**
 * Bounded self-adjustable knobs (D-0051, contract revised D-0052). The user's
 * contract: start from a default → J.A.R.V.I.S. may adjust from its own
 * operational record (sleep cycle) → a USER-set value is respected by default,
 * but is not permanent law: J.A.R.V.I.S. examines the trail SINCE the override
 * and may choose to keep it or change it once contradicting evidence clears a
 * HIGHER bar than for its own values — announcing either way. Each user
 * re-pin (re-setting after J.A.R.V.I.S. changed their setting) raises the bar
 * further, so insistence is itself learned. `source` records who set the
 * current value; `reason` says why; `at` anchors evidence counting.
 */
export interface Autotune {
  /** signals needed for auto-escalation: 1 (eager) or 2 (conservative default) */
  signalThreshold: 1 | 2;
  source: "default" | "jarvis" | "user";
  reason?: string;
  /** ISO time the current value was set — evidence is counted AFTER this */
  at?: string;
  /** user re-pins after a J.A.R.V.I.S. change of their setting; each raises
   *  the evidence bar for changing it again */
  repins?: number;
  /** set on a jarvis record that replaced a user setting (drives re-pin count) */
  changedUserSetting?: boolean;
}
export const DEFAULT_AUTOTUNE: Autotune = { signalThreshold: 2, source: "default" };

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
  constructor(
    private readonly store: TunerStore,
    /** optional fast-model topic extractor (D-0075) — best-effort; a null result
     *  (no judge / no eligible provider / failure) falls back to `salientTerms`,
     *  which accumulates candidates but can never promote one (D-0080 C2).
     *  Only used off the hot path (learning-by-correction), never in `assessDepth`,
     *  which stays deterministic + zero-latency by design. */
    private readonly judge?: { extractTopics(text: string, privacy: "STANDARD" | "LOCAL_ONLY"): Promise<string[] | null> },
  ) {}

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

  /** Current bounded knobs. Best-effort: default on any failure. */
  async autotune(): Promise<Autotune> {
    const raw = await this.readJson<Autotune>(AUTOTUNE_KEY, DEFAULT_AUTOTUNE);
    return raw.signalThreshold === 1 || raw.signalThreshold === 2 ? raw : DEFAULT_AUTOTUNE;
  }

  /**
   * Set the escalation threshold. A plain "jarvis" write still refuses to
   * replace a "user" value — only the sleep cycle, having verified that the
   * evidence since the pin clears the (re-pin-scaled) bar, passes
   * `overrideUser: true` (D-0052). A "user" write always applies; re-pinning
   * after a J.A.R.V.I.S. change increments `repins`, raising the future bar.
   */
  async setThreshold(
    value: 1 | 2,
    source: "jarvis" | "user",
    reason: string,
    opts?: { overrideUser?: boolean },
  ): Promise<{ applied: boolean; autotune: Autotune }> {
    const current = await this.autotune();
    if (source === "jarvis" && current.source === "user" && !opts?.overrideUser) {
      return { applied: false, autotune: current };
    }
    const repins =
      source === "user" && current.source === "jarvis" && current.changedUserSetting
        ? (current.repins ?? 0) + 1
        : current.repins ?? 0;
    const next: Autotune = {
      signalThreshold: value,
      source,
      reason,
      at: new Date().toISOString(),
      ...(repins ? { repins } : {}),
      ...(source === "jarvis" && current.source === "user" ? { changedUserSetting: true } : {}),
    };
    await this.store.remember({
      key: AUTOTUNE_KEY,
      value: JSON.stringify(next),
      provenance: source === "user" ? "user-override" : "sleep-cycle",
    });
    return { applied: true, autotune: next };
  }

  /** Clear any override (user or jarvis) back to the default — J.A.R.V.I.S.
   *  may adjust again afterwards. */
  async reset(): Promise<Autotune> {
    await this.store.remember({
      key: AUTOTUNE_KEY,
      value: JSON.stringify(DEFAULT_AUTOTUNE),
      provenance: "user-instruction",
    });
    return DEFAULT_AUTOTUNE;
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
   * turn the auto assessment judged fast. Returns what was promoted, what was
   * merely noted, and whether promotion is deferred for lack of a judge.
   */
  async recordCorrection(text: string): Promise<CorrectionOutcome> {
    const raw = await this.readJson<Record<string, number | Partial<Candidate>>>(DEEP_CANDIDATES_KEY, {});
    // Backward-compat: pre-D-0080 rows stored a bare count per term. Whether
    // those were judge-confirmed is unknowable, so they carry judged=0 — one
    // confirmed mention promotes them (the count is already there).
    const counts: Record<string, Candidate> = {};
    for (const [k, v] of Object.entries(raw)) {
      counts[k] =
        typeof v === "number" ? { count: v, judged: 0 } : { count: v.count ?? 0, judged: v.judged ?? 0 };
    }
    const topics = await this.topics();
    const promoted: string[] = [];
    const noted: string[] = [];
    // Prefer a fast-model extraction of the SPECIFIC topic (D-0075). The heuristic
    // `salientTerms` grabs filler words ('quick','one-line','intuition') from
    // prompt phrasing; the model returns the real subject ('palladium'). A null
    // result (no judge / no eligible provider / failure) falls back to the
    // heuristic — which may accumulate but never promote (D-0080 C2); an empty
    // list is a valid judged "no substantive topic" (no fallback).
    const extracted = this.judge ? await this.judge.extractTopics(text, "STANDARD") : null;
    const judged = extracted !== null;
    const terms = extracted ?? salientTerms(text);
    for (const term of terms) {
      if (topics.includes(term)) continue;
      const c = counts[term] ?? { count: 0, judged: 0 };
      c.count += 1;
      if (judged) c.judged += 1;
      if (c.count >= PROMOTE_AT && c.judged >= 1) {
        promoted.push(term);
        delete counts[term];
      } else {
        counts[term] = c;
        noted.push(term);
      }
    }
    // Keep the ledger bounded: drop never-judged entries, lowest count first.
    const keys = Object.keys(counts);
    if (keys.length > MAX_CANDIDATES) {
      const droppable = keys
        .filter((k) => counts[k]!.judged === 0)
        .sort((a, b) => counts[a]!.count - counts[b]!.count);
      for (const k of droppable.slice(0, keys.length - MAX_CANDIDATES)) delete counts[k];
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
    return { promoted, noted, deferred: !judged && noted.length > 0 };
  }
}
