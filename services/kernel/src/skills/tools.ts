import type { Tool, ToolContext, ToolResult } from "../core/tools.js";
import type { SkillRegistry } from "./registry.js";

/**
 * Skill tools (D-0075) — the self-authoring + reuse layer over the skills
 * registry. Before this, skills could only be created and run from the HTTP
 * routes (a human), so J.A.R.V.I.S. could author a CODE capability but not a
 * no-code, named, reusable "skill", and could not re-run one it had saved.
 *
 * A skill grants NO new capability: running it executes its objective through
 * the agent, and every step still goes through the gated core loop (a
 * consequential inner step still prompts; e-stop still halts; the step budget
 * still bounds it). These tools only let J.A.R.V.I.S. NAME, FIND, and REUSE what
 * it can already do.
 */
export function skillTools(skills: SkillRegistry): Tool[] {
  const save: Tool = {
    name: "skill.save",
    description:
      "Save a reusable SKILL — a named objective you (or the user) can run again later. " +
      "Use this to remember 'how to do X' as a repeatable task (e.g. 'morning briefing', " +
      "'workshop safety check'). No code; the objective is plain instructions run through the " +
      "gated agent. Reversible (delete removes it).",
    riskClass: "LOW_REVERSIBLE",
    action: "save reusable skill",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "short, unique skill name" },
        objective: { type: "string", description: "what the skill should accomplish when run (plain instructions)" },
        description: { type: "string", description: "one-line summary of the skill" },
        maxSteps: { type: "number", description: "max agent steps when run (default 6)" },
      },
      required: ["name", "objective"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { name: string; objective: string; description?: string; maxSteps?: number };
      try {
        const s = await skills.create({
          name: a.name,
          objective: a.objective,
          ...(a.description ? { description: a.description } : {}),
          ...(a.maxSteps ? { maxSteps: a.maxSteps } : {}),
          createdBy: "jarvis",
        });
        return {
          ok: true,
          summary: `saved skill '${s.name}' — reusable via skill.run`,
          data: { id: s.id, name: s.name },
          rollback: async () => { await skills.delete(s.id); },
        };
      } catch (err) {
        return { ok: false, summary: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const list: Tool = {
    name: "skill.list",
    description:
      "List the reusable skills you have saved (name, what they do, when last run) — so you can " +
      "find and re-run one instead of redoing the work from scratch. Read-only.",
    riskClass: "READ_ONLY",
    action: "list reusable skills",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const all = await skills.list();
      if (!all.length) return { ok: true, summary: "no saved skills yet", data: [], detail: "No skills saved yet. Save one with skill.save." };
      const detail = ["saved skills:", ...all.map((s) => `  · ${s.name}${s.description ? ` — ${s.description}` : ""} [id: ${s.id}]${s.lastRunAt ? ` (last run ${s.lastRunAt})` : ""}`)].join("\n");
      return {
        ok: true,
        summary: `${all.length} saved skill(s)`,
        data: all.map((s) => ({ id: s.id, name: s.name, description: s.description, lastRunAt: s.lastRunAt })),
        detail,
      };
    },
  };

  const run: Tool = {
    name: "skill.run",
    description:
      "Run a saved skill by name (or id) — reuse a task you saved earlier. Its steps run through " +
      "the gated agent; a consequential step still needs approval.",
    riskClass: "CONSEQUENTIAL",
    action: "run reusable skill",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "skill name to run" },
        id: { type: "string", description: "OR the skill id" },
        privacyClass: {
          type: "string",
          enum: ["LOCAL_ONLY", "STANDARD"],
          description: "LOCAL_ONLY (default, private-first) keeps the skill on local models; STANDARD lets it use a configured remote reasoning provider when the user wants it",
        },
      },
      additionalProperties: false,
    },
    disclose(args: unknown) {
      const a = args as { name?: string; id?: string };
      const which = a.name ?? a.id ?? "(unspecified)";
      return {
        whatWillHappen: `the saved skill '${which}' will run through the gated agent (each step still gated)`,
        affected: [`skill '${which}'`],
        proposedCommands: [`skill.run ${which}`],
        reason: "reuse a previously-saved task",
        riskClass: "CONSEQUENTIAL" as const,
        reversible: false,
        rollbackPlan: "none — the skill's own steps are individually reversible where applicable",
      };
    },
    async run(args: unknown, ctx: ToolContext): Promise<ToolResult> {
      const a = args as { name?: string; id?: string; privacyClass?: "LOCAL_ONLY" | "STANDARD" };
      // Recursion guard: a skill's own agent run must not invoke skill.run again
      // (prevents unbounded skill→skill nesting).
      if (ctx.callSource?.startsWith("skill:")) {
        return { ok: false, summary: "refused: a running skill cannot invoke another skill (no nested skill.run)" };
      }
      const skill = a.id ? await skills.get(a.id) : a.name ? await skills.getByName(a.name) : null;
      if (!skill || !skill.enabled) {
        return { ok: false, summary: `no active skill '${a.name ?? a.id}' — use skill.list to see saved skills` };
      }
      // Do NOT blanket-propagate approval to the skill's DYNAMIC steps: each
      // consequential inner step gates on its own (safer than a fixed Stage-B
      // composition, whose steps are pre-reviewed). Policy stays DENY-first.
      const result = await skills.run(skill.id, a.privacyClass ? { privacyClass: a.privacyClass } : undefined);
      if (!result) return { ok: false, summary: `skill '${skill.name}' could not run` };
      const status = result.halted ? "halted (e-stop)" : result.budgetExhausted ? "step budget exhausted" : `${result.stepsUsed} step(s)`;
      return {
        ok: !result.halted,
        summary: `ran skill '${skill.name}' — ${status}`,
        data: { id: skill.id, name: skill.name, stepsUsed: result.stepsUsed, budgetExhausted: result.budgetExhausted, halted: result.halted },
        ...(result.answer ? { detail: String(result.answer) } : {}),
      };
    },
  };

  return [save, list, run];
}
