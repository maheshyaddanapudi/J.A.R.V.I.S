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

export function assessDepth(text: string): DepthAssessment {
  const t = text.trim();
  if (EXPLICIT_DEEP.test(t)) return { mode: "deep", why: "you asked for deeper thought" };

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
