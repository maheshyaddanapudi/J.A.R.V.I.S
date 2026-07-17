/**
 * Proactivity types (R-PRO-01…03). Proactive items are movie-style but
 * controlled: relevant, sparse, gated, explained, and NEVER consequential
 * without approval.
 */

export type Priority = "low" | "normal" | "high" | "critical";

export type ProactiveKind =
  | "deadline_due"
  | "commitment_overdue"
  | "calendar_conflict"
  | "briefing";

/** A candidate item before gating. */
export interface Candidate {
  kind: ProactiveKind;
  priority: Priority;
  domain: string;
  title: string;
  detail: string;
  /** 0..1 — how sure we are this is worth surfacing */
  confidence: number;
  /** stable key that identifies "the same alert" for dedup + snooze */
  dedupKey: string;
}

/** A surfaced item — passed every gate, carries its "why". */
export interface ProactiveItem extends Candidate {
  id: string;
  why: string;
  createdAt: string;
}

/** Why a candidate was suppressed (for observability, never silent). */
export interface Suppression {
  candidate: Candidate;
  gate: string;
  reason: string;
}

export interface GateConfig {
  /** local hours [start,end) during which only critical items surface */
  quietHours: { start: number; end: number } | null;
  /** minimum confidence to surface */
  confidenceThreshold: number;
  /** max items surfaced per rolling window */
  rateLimit: { max: number; windowMinutes: number };
  /** minimum priority to surface (below this is dropped) */
  minPriority: Priority;
}

export const DEFAULT_GATES: GateConfig = {
  quietHours: { start: 22, end: 7 },
  confidenceThreshold: 0.5,
  rateLimit: { max: 5, windowMinutes: 60 },
  minPriority: "low",
};

export const PRIORITY_ORDER: Priority[] = ["low", "normal", "high", "critical"];
export function priorityAtLeast(p: Priority, floor: Priority): boolean {
  return PRIORITY_ORDER.indexOf(p) >= PRIORITY_ORDER.indexOf(floor);
}
