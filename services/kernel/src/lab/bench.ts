/**
 * Real BenchRunner (D-0079): shells out to scripts/lab_bench.py, which boots
 * the ISOLATED lab kernel on its scratch DB and returns the scored report.
 * The kernel spawning a repo script is deliberate and documented (the same
 * trust level as the MCP server subprocesses it already spawns); the bench
 * script + bench/ tree are protected paths, hash-stamped into every report.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { BenchReport, BenchRunner } from "./engine.js";
import type { LabCandidate } from "./surface.js";

const exec = promisify(execFile);

export interface PyBenchOpts {
  /** repo root (where scripts/lab_bench.py and bench/ live) */
  repoRoot?: string;
  /** lab scratch database name (default jarvis_lab) */
  db?: string;
  /** lab kernel port (default 4571) */
  port?: number;
  /** hard timeout per bench run (default 15 min) */
  timeoutMs?: number;
  /** skip the rubric (gates-only) — used by tests, never by real campaigns */
  skipRubric?: boolean;
}

export class PyBenchRunner implements BenchRunner {
  constructor(private readonly opts: PyBenchOpts = {}) {}

  async run(candidate: LabCandidate | null): Promise<BenchReport> {
    const repo = resolve(this.opts.repoRoot ?? resolve(process.cwd(), "..", ".."));
    const tmp = await mkdtemp(join(tmpdir(), "night-lab-"));
    const outPath = join(tmp, "report.json");
    const args = [
      join(repo, "scripts", "lab_bench.py"),
      "--quiet",
      "--json-out", outPath,
      "--db", this.opts.db ?? "jarvis_lab",
      "--port", String(this.opts.port ?? 4571),
    ];
    if (this.opts.skipRubric) args.push("--skip-rubric");
    if (candidate) {
      const candPath = join(tmp, "candidate.json");
      await writeFile(candPath, JSON.stringify(candidate));
      args.push("--candidate-file", candPath);
    }
    try {
      // Exit 2 (gate failure) / 3 (ungraded) still write the report — read it
      // either way; only a missing report is a crash.
      await exec("python3", args, { cwd: repo, timeout: this.opts.timeoutMs ?? 900000 }).catch(async (err) => {
        try {
          await readFile(outPath);
        } catch {
          throw err;
        }
      });
      const raw = JSON.parse(await readFile(outPath, "utf8")) as {
        gates_pass: boolean;
        gates: BenchReport["gates"];
        scores: BenchReport["scores"];
        bench_hash: string;
        telemetry?: BenchReport["telemetry"];
        per_conversation?: { graded: boolean }[];
      };
      // An ungraded rubric conversation makes the run non-comparable — treat
      // as a crash rather than let partial scores masquerade as a measurement.
      if (!this.opts.skipRubric && (raw.per_conversation ?? []).some((c) => !c.graded)) {
        throw new Error("bench run had ungraded conversations (grader unavailable?)");
      }
      return {
        gates_pass: raw.gates_pass,
        gates: raw.gates ?? [],
        scores: raw.scores ?? {},
        bench_hash: raw.bench_hash ?? "",
        ...(raw.telemetry ? { telemetry: raw.telemetry } : {}),
      };
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
}
