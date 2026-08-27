import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import pg from "pg";
import { SkillRegistry } from "../src/skills/registry.js";
import { skillTools } from "../src/skills/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { AgentRuntime, AgentResult } from "../src/agent/contract.js";
import type { ToolContext } from "../src/core/tools.js";

const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* skip */
}

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

// A fake agent that records what objective it was asked to run.
function fakeAgent(): { agent: AgentRuntime; ran: { objective: string; maxSteps?: number; source?: string }[] } {
  const ran: { objective: string; maxSteps?: number; source?: string }[] = [];
  const agent: AgentRuntime = {
    async run(objective, opts): Promise<AgentResult> {
      ran.push({ objective, ...(opts?.maxSteps ? { maxSteps: opts.maxSteps } : {}), ...(opts?.source ? { source: opts.source } : {}) });
      return { objective, answer: "did it", steps: [], stepsUsed: 0, budgetExhausted: false, halted: false };
    },
  };
  return { agent, ran };
}

afterAll(async () => {
  await pool?.end();
});

describe.skipIf(!pool)("SkillRegistry (saved named objectives run via the agent)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE skills");
  });

  it("creates, lists, and runs a skill through the agent", async () => {
    const { agent, ran } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    const s = await reg.create({ name: "morning briefing", objective: "summarize my day", maxSteps: 4 });
    expect(s.name).toBe("morning briefing");
    expect((await reg.list()).map((x) => x.name)).toEqual(["morning briefing"]);

    const res = await reg.run(s.id);
    expect(res?.answer).toBe("did it");
    // it ran the skill's objective + maxSteps through the agent, tagged as a skill
    expect(ran).toEqual([{ objective: "summarize my day", maxSteps: 4, source: "skill:morning briefing" }]);
    // last_run_at recorded
    const got = await reg.get(s.id);
    expect(got?.lastRunAt).not.toBeNull();
  });

  it("re-creating a skill with the same name supersedes the old one (unique active name)", async () => {
    const { agent } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    await reg.create({ name: "dupe", objective: "v1" });
    await reg.create({ name: "dupe", objective: "v2" });
    const list = await reg.list();
    expect(list.length).toBe(1);
    expect(list[0]!.objective).toBe("v2");
  });

  it("delete disables the skill; running a disabled/absent skill returns null", async () => {
    const { agent } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    const s = await reg.create({ name: "temp", objective: "x" });
    expect(await reg.delete(s.id)).toBe(true);
    expect(await reg.list()).toEqual([]);
    expect(await reg.run(s.id)).toBeNull();
    expect(await reg.run("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("passes autoApprove through to the agent when provided", async () => {
    const { agent } = fakeAgent();
    const runSpy = vi.spyOn(agent, "run");
    const reg = new SkillRegistry(pool!, audit, agent);
    const s = await reg.create({ name: "act", objective: "do the thing" });
    await reg.run(s.id, { autoApprove: "allow-once" });
    expect(runSpy).toHaveBeenCalledWith("do the thing", expect.objectContaining({ autoApprove: "allow-once" }));
  });

  it("rejects an empty name or objective", async () => {
    const { agent } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    await expect(reg.create({ name: "  ", objective: "x" })).rejects.toThrow(/name/);
    await expect(reg.create({ name: "ok", objective: "  " })).rejects.toThrow(/objective/);
  });
});

describe.skipIf(!pool)("skill tools (self-authoring + reuse, D-0075)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE skills");
  });
  const ctx: ToolContext = { workspaceRoot: "/tmp" };

  it("skill.save authors a reusable skill; skill.list discovers it", async () => {
    const { agent } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    const [save, list] = skillTools(reg);
    const r = await save!.run(
      { name: "fire check", objective: "check the workshop for fire hazards", description: "safety sweep" },
      ctx,
    );
    expect(r.ok).toBe(true);
    const listed = await list!.run({}, ctx);
    expect(listed.detail).toContain("fire check");
    expect(listed.detail).toContain("safety sweep");
    // authored by J.A.R.V.I.S. → audited as actor 'jarvis'
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "jarvis", event: "skill_created" }),
    );
  });

  it("skill.run reuses a saved skill through the gated agent", async () => {
    const { agent, ran } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    const run = skillTools(reg).find((t) => t.name === "skill.run")!;
    await reg.create({ name: "brief", objective: "summarize the day" });
    const r = await run.run({ name: "brief" }, ctx);
    expect(r.ok).toBe(true);
    expect(ran.map((x) => x.objective)).toContain("summarize the day");
  });

  it("skill.run refuses when nested inside another skill (recursion guard)", async () => {
    const { agent } = fakeAgent();
    const reg = new SkillRegistry(pool!, audit, agent);
    const run = skillTools(reg).find((t) => t.name === "skill.run")!;
    await reg.create({ name: "x", objective: "y" });
    const r = await run.run({ name: "x" }, { workspaceRoot: "/tmp", callSource: "skill:outer" });
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/nested|cannot invoke another skill/i);
  });

  it("skill.save is LOW_REVERSIBLE, skill.run is CONSEQUENTIAL (gated)", () => {
    const tools = skillTools(new SkillRegistry(pool!, audit, fakeAgent().agent));
    expect(tools.find((t) => t.name === "skill.save")!.riskClass).toBe("LOW_REVERSIBLE");
    expect(tools.find((t) => t.name === "skill.run")!.riskClass).toBe("CONSEQUENTIAL");
  });
});
