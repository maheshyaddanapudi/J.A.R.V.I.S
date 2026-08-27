/**
 * Terminal-with-policy capability (Phase 2 — "terminal with policy"). Lets
 * J.A.R.V.I.S. run real shell commands, but every command passes a safety policy
 * first and is scoped to the workspace.
 *
 * REAL (honesty rule R-CORE-02) — it runs actual commands, not a simulator. It is
 * high-risk, so it is the most tightly gated capability after physical devices:
 * a DENYLIST refuses dangerous commands outright (clean pre-approval denial), a
 * conservative READ_ONLY allowlist auto-runs a few safe inspections, and
 * EVERYTHING ELSE is CONSEQUENTIAL (per-command approval + audit). The working
 * directory is confined to the workspace root.
 */

export type Provenance = "REAL" | "SIMULATION";

export interface CommandResult {
  command: string;
  /** absolute working directory the command ran in (inside the workspace) */
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** true when stdout/stderr was capped */
  truncated: boolean;
  provenance: Provenance;
}

export interface RunOptions {
  /** working directory relative to the workspace root (default: the root) */
  cwd?: string;
  /** hard timeout in ms (default 20s, max 120s) */
  timeoutMs?: number;
}

export interface TerminalRunner {
  readonly provenance: Provenance;
  /** Resolve a relative cwd to an absolute path, throwing if it escapes the workspace. */
  resolveCwd(cwd?: string): string;
  run(command: string, opts?: RunOptions): Promise<CommandResult>;
}
