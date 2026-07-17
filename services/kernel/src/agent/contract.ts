/**
 * Agent runtime (jarvis-mind foundation). Turns an objective into a bounded
 * multi-step plan-and-act loop: the model proposes tool calls, each executes
 * through the SAME gated core loop (policy → approval → execution → independent
 * verification), results feed back, and the model either acts again or answers.
 *
 * This is the "next action" part of the core loop (docs/01) — J.A.R.V.I.S. doing
 * a real multi-step task, not a single tool call. Isolated behind this interface
 * (D-0009) so a heavier Python/LangGraph runtime can replace the built-in local
 * one without touching callers.
 *
 * SAFETY: the runtime ORCHESTRATES; it never bypasses a gate. Every tool step is
 * the ordinary gated `CoreLoop.runTool`, so consequential actions still require
 * approval and the emergency stop still halts mid-plan. The step budget bounds
 * runaway loops (R-SEC-04). Nothing here grants a new capability.
 */

export interface AgentStep {
  index: number;
  tool: string;
  args: unknown;
  ok: boolean;
  denied?: boolean;
  summary: string;
}

export interface AgentResult {
  objective: string;
  answer: string;
  steps: AgentStep[];
  stepsUsed: number;
  /** true if the step budget was exhausted before the model produced an answer */
  budgetExhausted: boolean;
  /** true if the emergency stop halted the plan mid-flight */
  halted: boolean;
}

export interface AgentRunOptions {
  /** hard cap on tool steps (R-SEC-04 runaway bound); default is set by the runtime */
  maxSteps?: number;
  privacyClass?: "LOCAL_ONLY" | "STANDARD";
  source?: string;
  /**
   * Scripted/testing auto-resolution for any approval a step triggers. In real
   * use this is omitted and each consequential step waits for a real approval.
   */
  autoApprove?: "allow-once" | "allow-for-task" | "allow-for-session" | "always-allow-in-scope" | "deny";
}

export interface AgentRuntime {
  run(objective: string, opts?: AgentRunOptions): Promise<AgentResult>;
}
