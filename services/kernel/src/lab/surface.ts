/**
 * NIGHT-LAB EDITABLE SURFACE (D-0079, R-LAB-02) — PROTECTED PATH.
 *
 * The complete, explicit ALLOWLIST of what the lab may experiment on. This is
 * the lab's equivalent of autoresearch's "only train.py": the constraint is
 * the safety property. It lives inside Z1 (registered in selfext/protected.ts)
 * so neither a generated capability nor the lab itself can widen it.
 *
 * Deny-first: a candidate touching ANYTHING not explicitly listed here is
 * rejected outright — never a warning. In particular the lab can never touch
 * its own envelope (budget/autonomy/sleep/lab/quiet-hours/reporting), Z1, any
 * code file, or the bench (the bench simply is not a prompt or a setting).
 */

import { JUDGE_TEMPLATES } from "../memory/judge.js";

/** Prompt surface: name+kind pairs the lab may propose new content for. */
export interface LabPromptSurface {
  name: string;
  kind: "template" | "persona";
  /** "auto" may be applied to live by the lab within the envelope;
   *  "proposal" ALWAYS requires explicit user approval (three-envelope rule). */
  envelope: "auto" | "proposal";
}

/** The five judge templates (auto-appliable) + the persona (proposal-only —
 *  the persona is the user's relationship with J.A.R.V.I.S., not a tunable). */
export const LAB_PROMPT_SURFACE: readonly LabPromptSurface[] = [
  ...Object.keys(JUDGE_TEMPLATES).map((name) => ({
    name,
    kind: "template" as const,
    envelope: "auto" as const,
  })),
  // kind=persona: any name is in-surface (the active persona's name is data),
  // but ALWAYS proposal-envelope. Matched by kind below.
  { name: "*", kind: "persona", envelope: "proposal" },
];

/** Settings the lab may experiment on. Everything else is out of surface. */
export const LAB_SETTINGS_SURFACE: readonly string[] = [
  "memory.consolidation.overlap",
  "memory.consolidation.staleDays",
  "proactive.confidenceThreshold",
  "proactive.minPriority",
  "heartbeat.deferWhileActiveMinutes",
  "heartbeat.maxSteps",
];

/**
 * Defense-in-depth: prefixes that must NEVER appear in a candidate even if a
 * future edit accidentally added one to the allowlist above. The lab's own
 * envelope, spend, scheduling, privacy, consent, and reporting knobs.
 * Checked BEFORE the allowlist; a hit here is reported as an envelope
 * violation explicitly.
 */
export const LAB_FORBIDDEN_SETTING_PREFIXES: readonly string[] = [
  "budget.",
  "autonomy.",
  "sleep.",
  "lab.",
  "proactive.quietHours.",
  "heartbeat.privacy",
  "affect.enabled",
  "announce.",
  "memory.llmJudgment",
  "gateway.",
];

export interface LabCandidate {
  /** one-line human summary of the change (for the ledger + morning report) */
  summary: string;
  /** the hypothesis being tested (from the campaign) */
  hypothesis?: string;
  prompts?: { name: string; kind: "template" | "persona"; content: string }[];
  settings?: Record<string, unknown>;
}

export interface SurfaceVerdict {
  ok: boolean;
  violations: string[];
  /** strictest envelope across everything the candidate touches */
  envelope: "auto" | "proposal";
}

/** Deny-first validation. Empty candidates are invalid (nothing to test). */
export function validateCandidate(c: LabCandidate): SurfaceVerdict {
  const violations: string[] = [];
  let envelope: "auto" | "proposal" = "auto";
  const prompts = c.prompts ?? [];
  const settings = Object.keys(c.settings ?? {});
  if (prompts.length === 0 && settings.length === 0) {
    violations.push("empty candidate: no prompts and no settings");
  }
  for (const p of prompts) {
    if (!p.content || !p.content.trim()) {
      violations.push(`prompt '${p.name}': empty content`);
      continue;
    }
    if (p.kind === "persona") {
      envelope = "proposal";
      continue; // in-surface by kind; always proposal
    }
    const hit = LAB_PROMPT_SURFACE.find((s) => s.kind === p.kind && s.name === p.name);
    if (!hit) {
      violations.push(`prompt '${p.name}' (${p.kind}): not on LAB_PROMPT_SURFACE`);
    } else if (hit.envelope === "proposal") {
      envelope = "proposal";
    }
  }
  for (const key of settings) {
    const forbidden = LAB_FORBIDDEN_SETTING_PREFIXES.find((pre) => key === pre || key.startsWith(pre));
    if (forbidden) {
      violations.push(`setting '${key}': the lab may never touch its own envelope ('${forbidden}')`);
      continue;
    }
    if (!LAB_SETTINGS_SURFACE.includes(key)) {
      violations.push(`setting '${key}': not on LAB_SETTINGS_SURFACE`);
    }
  }
  return { ok: violations.length === 0, violations, envelope };
}
