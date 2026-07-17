/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Activity event bus. Every meaningful kernel step emits an event so the
 * Command Center timeline shows live execution state (R-CORE-03: "streams
 * concise execution state"). Never carries hidden chain-of-thought.
 */

export type ActivityEvent =
  | { kind: "objective"; text: string; at: string }
  | { kind: "decision"; summary: string; at: string }
  | { kind: "model"; role: string; provider: string; model: string; at: string }
  | { kind: "token"; text: string; at: string }
  | { kind: "tool_proposed"; tool: string; risk: string; disclosure: ActionDisclosure; at: string }
  | { kind: "approval_required"; tool: string; requestId: string; at: string }
  | { kind: "tool_result"; tool: string; ok: boolean; summary: string; at: string }
  | { kind: "verified"; ok: boolean; summary: string; at: string }
  | { kind: "estop"; engaged: boolean; at: string }
  | { kind: "error"; message: string; at: string };

export interface ActionDisclosure {
  whatWillHappen: string;
  affected: string[];
  proposedCommands: string[];
  reason: string;
  riskClass: string;
  reversible: boolean;
  rollbackPlan: string;
}

export class ActivityBus {
  private listeners = new Set<(e: ActivityEvent) => void>();

  subscribe(fn: (e: ActivityEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event: ActivityEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}
