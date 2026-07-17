import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import type { GatherOptions, Researcher } from "./contract.js";

/**
 * Research tool (parity C3). CONSEQUENTIAL — it reaches the network (opens the
 * named sources), so it discloses ALL target URLs upfront and is approval-gated
 * as one research action; any out-of-policy URL (bad scheme, offline external)
 * makes it a clean pre-approval denial. The result is EVIDENCE with per-claim
 * provenance (url + title + line + snippet), fed to the agent as `detail` so it
 * can synthesize an answer that cites its sources — never an unsourced claim.
 */
export function researchTools(researcher: Researcher): Tool[] {
  const gather: Tool = {
    name: "research.gather",
    description:
      "Research a question across the given web sources and return sourced evidence (each passage tagged with its URL). Consequential — opens the sources; requires approval.",
    riskClass: "CONSEQUENTIAL",
    action: "research across web sources",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "the question / topic to gather evidence for" },
        urls: {
          type: "array",
          items: { type: "string" },
          description: "source URLs (http/https) to consult",
        },
        perSource: { type: "number", description: "max passages per source (default 3)" },
      },
      required: ["query", "urls"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as { query: string; urls: string[] };
      if (!Array.isArray(a.urls) || a.urls.length === 0) throw new Error("refused: no source URLs given");
      const checks = researcher.checkTargets(a.urls);
      const bad = checks.find((c) => !c.allowed);
      if (bad) throw new Error(`refused: ${bad.url} — ${bad.reason}`);
      return {
        whatWillHappen: `Open ${a.urls.length} source(s) and extract passages relevant to "${a.query}".`,
        affected: a.urls,
        proposedCommands: a.urls.map((u) => `open → ${u}`),
        reason: "User asked J.A.R.V.I.S. to research a question across the web.",
        riskClass: "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "Reading pages has no side effect on the user's machine.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { query: string; urls: string[]; perSource?: number };
      const opts: GatherOptions = {};
      if (a.perSource !== undefined) opts.perSource = a.perSource;
      const r = await researcher.gather(a.query, a.urls, opts);
      const okSources = r.sources.filter((s) => s.ok).length;
      const failed = r.sources.filter((s) => !s.ok);
      const lines = [
        `Research: "${r.query}" — ${r.evidence.length} passage(s) from ${okSources}/${r.sources.length} source(s).`,
        ...r.evidence.map((e, i) => `[${i + 1}] (${e.title || e.url} :${e.line}) ${e.snippet}\n    source: ${e.url}`),
      ];
      if (failed.length) lines.push(`skipped: ${failed.map((s) => `${s.url} (${s.error})`).join("; ")}`);
      return {
        ok: r.evidence.length > 0 || okSources > 0,
        summary: `${r.evidence.length} passage(s) from ${okSources}/${r.sources.length} source(s)`,
        data: r,
        // Sourced evidence for the agent to cite (per-claim provenance).
        detail: lines.join("\n"),
      };
    },
  };

  return [gather];
}
