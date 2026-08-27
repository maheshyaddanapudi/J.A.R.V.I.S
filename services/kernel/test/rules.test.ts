import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { ProactiveRules, parseCondition } from "../src/proactive/rules.js";
import { ProactivityEngine } from "../src/proactive/engine.js";
import { ActivityBus } from "../src/core/activity.js";
import type { AuditLog } from "../src/core/audit.js";

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
const NOW = new Date("2026-07-17T09:00:00Z"); // 9am — morning, outside quiet hours

describe("parseCondition (closed, safe set)", () => {
  it("accepts the three known conditions and rejects anything else", () => {
    expect(parseCondition({ type: "part_of_day", value: "morning" })).toEqual({ type: "part_of_day", value: "morning" });
    expect(parseCondition({ type: "commitment_due_within", minutes: 90 })).toEqual({ type: "commitment_due_within", minutes: 90 });
    expect(parseCondition({ type: "commitment_overdue" })).toEqual({ type: "commitment_overdue" });
    expect(() => parseCondition({ type: "eval", code: "process.exit()" })).toThrow(/unknown rule condition/);
    expect(() => parseCondition({ type: "part_of_day", value: "lunchtime" })).toThrow(/part_of_day/);
    expect(() => parseCondition({ type: "commitment_due_within", minutes: -5 })).toThrow(/positive minutes/);
  });
});

describe.skipIf(!pool)("ProactiveRules (user-defined proactivity)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE proactive_rules, commitments, proactive_items, proactive_snoozes, proactive_domain_settings");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("set / list / setEnabled / remove", async () => {
    const rules = new ProactiveRules(pool!, audit);
    await rules.set({ name: "morning-brief", title: "Morning check-in", condition: { type: "part_of_day", value: "morning" } });
    let all = await rules.list();
    expect(all.map((r) => r.name)).toContain("morning-brief");
    expect(all[0]!.enabled).toBe(true);
    expect(await rules.setEnabled("morning-brief", false)).toBe(true);
    expect((await rules.list())[0]!.enabled).toBe(false);
    expect(await rules.remove("morning-brief")).toBe(true);
    expect(await rules.list()).toHaveLength(0);
  });

  it("refuses an unknown condition on write (no code execution possible)", async () => {
    const rules = new ProactiveRules(pool!, audit);
    await expect(rules.set({ name: "evil", title: "x", condition: { type: "shell", cmd: "rm -rf /" } })).rejects.toThrow(/unknown rule condition/);
  });

  it("evaluates a part_of_day rule (fires in the morning)", async () => {
    const rules = new ProactiveRules(pool!, audit);
    await rules.set({ name: "am", title: "Review priorities", condition: { type: "part_of_day", value: "morning" } });
    const morning = await rules.evaluate(NOW);
    expect(morning.map((c) => c.title)).toContain("Review priorities");
    // …and does not fire in the evening
    const evening = await rules.evaluate(new Date("2026-07-17T20:00:00Z"));
    expect(evening).toHaveLength(0);
  });

  it("evaluates commitment_due_within against real commitments", async () => {
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Ship the report", new Date(NOW.getTime() + 30 * 60_000), // 30 min away
    ]);
    const rules = new ProactiveRules(pool!, audit);
    await rules.set({ name: "soon", title: "Due soon", detail: "{commitment} is due at {due}", condition: { type: "commitment_due_within", minutes: 60 } });
    const within60 = await rules.evaluate(NOW);
    expect(within60).toHaveLength(1);
    expect(within60[0]!.detail).toContain("Ship the report"); // template filled

    // a 10-minute window does not catch a 30-minute-away commitment
    await rules.set({ name: "soon", title: "Due soon", condition: { type: "commitment_due_within", minutes: 10 } });
    expect(await rules.evaluate(NOW)).toHaveLength(0);
  });

  it("evaluates commitment_overdue", async () => {
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Overdue task", new Date(NOW.getTime() - 3 * 3_600_000), // 3h ago
    ]);
    const rules = new ProactiveRules(pool!, audit);
    await rules.set({ name: "od", title: "Overdue!", detail: "{commitment} is overdue", condition: { type: "commitment_overdue" } });
    const hits = await rules.evaluate(NOW);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.detail).toContain("Overdue task");
  });

  it("a rule's candidate surfaces through the engine's full gate stack", async () => {
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Overdue thing", new Date(NOW.getTime() - 2 * 3_600_000),
    ]);
    const rules = new ProactiveRules(pool!, audit);
    await rules.set({ name: "od", title: "You have an overdue item", detail: "{commitment}", condition: { type: "commitment_overdue" }, priority: "high" });
    const engine = new ProactivityEngine(pool!, audit, new ActivityBus(), undefined, rules);
    const { surfaced } = await engine.run(NOW);
    const ruleItem = surfaced.find((i) => i.kind === "user_rule");
    expect(ruleItem).toBeTruthy();
    expect(ruleItem!.title).toBe("You have an overdue item");
    expect(ruleItem!.why).toBeTruthy(); // carries a "why", like every surfaced item
  });
});
