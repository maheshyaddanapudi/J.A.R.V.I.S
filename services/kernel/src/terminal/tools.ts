import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import type { TerminalRunner } from "./contract.js";
import { assessCommand } from "./policy.js";

/**
 * Terminal tools, policy-gated (R-AUTO). Two entry points map the command policy
 * onto the kernel's static risk classes:
 *   - terminal.inspect (READ_ONLY): only accepts commands the policy rates
 *     read_only (a small safe allowlist, no shell operators); anything else is a
 *     clean pre-approval denial. Auto-runs.
 *   - terminal.run (CONSEQUENTIAL): everything else. The DENYLIST refuses
 *     dangerous/prohibited commands as a clean pre-approval denial; the rest
 *     require per-command approval, are audited, and their output is verified as
 *     REAL (exit code observed). Working dir confined to the workspace.
 *
 * Command output is fed to the agent as `detail` (bounded) but the audit records
 * only the summary — command output stays local.
 */
export function terminalTools(term: TerminalRunner): Tool[] {
  const inspect: Tool = {
    name: "terminal.inspect",
    description:
      "Run a safe, read-only inspection command (pwd, whoami, uname, ls, df, git status/log/diff, node --version, …). Read-only; other commands are refused — use terminal.run.",
    riskClass: "READ_ONLY",
    action: "run read-only shell inspection",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "a read-only inspection command" },
        cwd: { type: "string", description: "workspace-relative working directory" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const { command } = args as { command: string; cwd?: string };
      const a = assessCommand(command);
      if (a.verdict !== "read_only") {
        throw new Error(
          a.verdict === "denied"
            ? `refused: ${a.reason}`
            : `refused: '${command.split(/\s+/)[0]}' is not a read-only inspection — use terminal.run (it requires approval)`,
        );
      }
      return {
        whatWillHappen: `Run read-only: ${command}`,
        affected: [(args as { cwd?: string }).cwd ?? "(workspace root)"],
        proposedCommands: [command],
        reason: "User asked J.A.R.V.I.S. to inspect local state.",
        riskClass: "READ_ONLY",
        reversible: true,
        rollbackPlan: "Read-only inspection has no effect to undo.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const { command, cwd } = args as { command: string; cwd?: string };
      const r = await term.run(command, cwd !== undefined ? { cwd } : {});
      return toolResult(r);
    },
  };

  const run: Tool = {
    name: "terminal.run",
    description:
      "Run a shell command in the workspace (bash). Consequential — requires approval; dangerous/prohibited commands are refused outright.",
    riskClass: "CONSEQUENTIAL",
    action: "run a shell command",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "the command to run" },
        cwd: { type: "string", description: "workspace-relative working directory" },
        timeoutMs: { type: "number", description: "hard timeout (ms, max 120000)" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const { command, cwd } = args as { command: string; cwd?: string };
      const a = assessCommand(command);
      // Dangerous/prohibited commands are refused before approval is ever offered.
      if (a.verdict === "denied") throw new Error(`refused: ${a.reason}`);
      return {
        whatWillHappen: `Run in the workspace shell: ${command}`,
        affected: [cwd ?? "(workspace root)"],
        proposedCommands: [command],
        reason: "User asked J.A.R.V.I.S. to run a terminal command.",
        riskClass: "CONSEQUENTIAL",
        reversible: false,
        rollbackPlan: "Shell commands are not generally reversible; effects are observed after.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const { command, cwd, timeoutMs } = args as { command: string; cwd?: string; timeoutMs?: number };
      const opts: { cwd?: string; timeoutMs?: number } = {};
      if (cwd !== undefined) opts.cwd = cwd;
      if (timeoutMs !== undefined) opts.timeoutMs = timeoutMs;
      const r = await term.run(command, opts);
      return toolResult(r);
    },
  };

  return [inspect, run];
}

function toolResult(r: import("./contract.js").CommandResult): ToolResult {
  const detailParts = [`$ ${r.command}`, `(cwd ${r.cwd}, exit ${r.exitCode}, ${r.durationMs}ms)`];
  if (r.stdout) detailParts.push("--- stdout ---", r.stdout.trimEnd());
  if (r.stderr) detailParts.push("--- stderr ---", r.stderr.trimEnd());
  return {
    ok: r.exitCode === 0,
    summary: `exit ${r.exitCode} · ${r.durationMs}ms${r.truncated ? " · output truncated" : ""} (${r.provenance})`,
    data: r,
    detail: detailParts.join("\n"),
  };
}
