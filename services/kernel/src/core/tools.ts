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
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
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
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  list(): Tool[] {
    return [...this.tools.values()];
  }
}
