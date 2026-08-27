import { execFile } from "node:child_process";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import type { CommandResult, RunOptions, TerminalRunner } from "./contract.js";

const DEFAULT_TIMEOUT = 20_000;
const MAX_TIMEOUT = 120_000;
const MAX_BUFFER = 1024 * 1024; // 1 MiB per stream
const OUTPUT_CAP = 20_000; // chars returned per stream

/**
 * REAL local terminal. Commands run via `bash -lc <command>` with the working
 * directory confined to the workspace root, a hard timeout, and bounded output.
 * Safety CLASSIFICATION is done by the policy (assessCommand) and enforced by the
 * gated tools; this runner just executes what the gate has already allowed.
 */
export class LocalTerminal implements TerminalRunner {
  readonly provenance = "REAL" as const;
  constructor(private readonly workspaceRoot: string) {}

  resolveCwd(cwd?: string): string {
    const root = resolve(this.workspaceRoot);
    const rel = (cwd ?? "").trim();
    if (!rel) return root;
    if (isAbsolute(rel)) throw new Error(`refused: cwd '${cwd}' is absolute (outside the workspace)`);
    const target = resolve(root, rel);
    const relToRoot = relative(root, target);
    if (relToRoot.startsWith("..") || relToRoot.startsWith(`..${sep}`)) {
      throw new Error(`refused: cwd '${cwd}' is outside the workspace`);
    }
    return normalize(target);
  }

  async run(command: string, opts: RunOptions = {}): Promise<CommandResult> {
    const cwd = this.resolveCwd(opts.cwd);
    const timeout = Math.min(Math.max(opts.timeoutMs ?? DEFAULT_TIMEOUT, 1000), MAX_TIMEOUT);
    const started = process.hrtime.bigint();

    return await new Promise<CommandResult>((resolvePromise) => {
      execFile(
        "/bin/bash",
        ["-lc", command],
        { cwd, timeout, maxBuffer: MAX_BUFFER, killSignal: "SIGKILL" },
        (err, stdout, stderr) => {
          const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
          const out = String(stdout ?? "");
          const errOut = String(stderr ?? "");
          const truncated = out.length > OUTPUT_CAP || errOut.length > OUTPUT_CAP;
          // execFile's err carries the exit code (or is a timeout kill).
          let exitCode = 0;
          if (err) {
            const e = err as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
            if (e.killed) exitCode = 124; // timed out (killed)
            else if (typeof e.code === "number") exitCode = e.code;
            else exitCode = 1;
          }
          resolvePromise({
            command,
            cwd,
            exitCode,
            stdout: out.slice(0, OUTPUT_CAP),
            stderr: errOut.slice(0, OUTPUT_CAP),
            durationMs: Math.round(durationMs),
            truncated,
            provenance: "REAL",
          });
        },
      );
    });
  }
}
