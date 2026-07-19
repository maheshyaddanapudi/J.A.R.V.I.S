import type { ActionDisclosure } from "./activity.js";
import type { RiskClass } from "./policy.js";

/**
 * Tool registry + the two Phase-1 tools. Every tool declares its risk class and
 * — for consequential actions — produces a pre-action disclosure and, where
 * reversible, an executed-undo plan captured BEFORE execution (R-CTRL-03/04).
 *
 * These are REAL tools (honesty rule): the read-only tool reads real host state;
 * the reversible tool performs a real, reversible filesystem operation inside a
 * scoped workspace with a captured rollback.
 */

export interface ToolContext {
  /** workspace root the reversible tool is scoped to (never outside it) */
  workspaceRoot: string;
  /**
   * The approval decision the CALLER supplied for this invocation, and the
   * caller's source. The loop populates these per-call. A composite tool (a
   * Stage-B `capability:<name>`) reads them so the user's approval of the named
   * composite propagates to its FIXED, already-reviewed composed steps — the
   * user shouldn't be re-prompted per step for a single logical action they
   * approved by name. Policy still evaluates every step (DENY-first: a dangerous
   * command is refused regardless of any approval), so propagation never widens
   * what is allowed — it only avoids a redundant second prompt.
   */
  autoApprove?: import("./approvals.js").ApprovalResolution;
  /** the caller's source string (for audit/provenance on nested steps) */
  callSource?: string;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  /**
   * Concise, model-facing rendering of the result (e.g. the file's text, the
   * search matches). Opt-in: tools whose OUTPUT should inform the agent's
   * reasoning set this. The agent feeds a bounded slice of it back to the model;
   * `summary` alone (one line) is not enough for a read tool to be useful.
   */
  detail?: string;
  /**
   * True when `detail` is EXTERNAL/untrusted content (a web page, MCP-server
   * output). The agent wraps it in an <untrusted_external_data> envelope before
   * feeding it to the model (THREAT_MODEL T1: data, never instructions).
   */
  untrusted?: boolean;
  /** present when the action was reversible and applied; calling it undoes the action */
  rollback?: () => Promise<void>;
}

export interface Tool {
  name: string;
  description: string;
  riskClass: RiskClass;
  /** semantic action verb for the policy engine */
  action: string;
  inputSchema: Record<string, unknown>;
  /** describe the effect before running (consequential tools) */
  disclose?(args: unknown, ctx: ToolContext): ActionDisclosure;
  run(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  /**
   * Remove a tool by name (returns true if one was present). Used only to
   * DEACTIVATE a Stage-B capability tool (D-0073); the built-in Z1 tools are
   * never unregistered at runtime.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }
  has(name: string): boolean {
    return this.tools.has(name);
  }
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  list(): Tool[] {
    return [...this.tools.values()];
  }
}
