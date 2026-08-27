import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { ProactivityEngine } from "../src/proactive/engine.js";
import { GateStack } from "../src/proactive/gates.js";
import type { AuditLog } from "../src/core/audit.js";
import { ActivityBus } from "../src/core/activity.js";
import type { Candidate, GateConfig } from "../src/proactive/types.js";

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
const NOW = new Date("2026-07-17T09:00:00Z"); // 9am — outside quiet hours

function cand(over: Partial<Candidate>): Candidate {
  return {
    kind: "deadline_due",
    priority: "normal",
    domain: "general",
    title: "t",
    detail: "d",
    confidence: 0.9,
    dedupKey: `k-${Math.round(over.confidence ?? 0)}-${over.title ?? "t"}`,
    ...over,
  };
}

describe.skipIf(!pool)("ProactivityEngine + gates (integration)", () => {
  const activity = new ActivityBus();
  let engine: ProactivityEngine;

  beforeAll(() => {
    engine = new ProactivityEngine(pool!, audit, activity);
  });
  beforeEach(async () => {
    await pool!.query(
      "TRUNCATE commitments, calendar_events, proactive_items, proactive_snoozes, proactive_domain_settings",
    );
    // disable the daily-briefing domain in these focused tests so we assert on
    // the specific item under test (the briefing is exercised on its own).
    await pool!.query(
      "INSERT INTO proactive_domain_settings (domain, enabled) VALUES ('briefing', false)",
    );
  });

  it("surfaces an upcoming deadline and records a 'why'", async () => {
    await pool!.query(
      "INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')",
      ["Ship the report", new Date(NOW.getTime() + 90 * 60_000)], // 1.5h away
    );
    const { surfaced } = await engine.run(NOW);
    const deadline = surfaced.find((i) => i.kind === "deadline_due");
    expect(deadline).toBeDefined();
    expect(deadline!.title).toMatch(/Ship the report/);
    expect(deadline!.priority).toBe("high"); // <=2h → high
    expect(deadline!.why).toMatch(/Surfaced because/);
  });

  it("composes a briefing when items are due today", async () => {
    await pool!.query("DELETE FROM proactive_domain_settings WHERE domain='briefing'");
    await pool!.query("INSERT INTO calendar_events (title, starts_at, ends_at) VALUES ($1,$2,$3)", [
      "Board meeting",
      new Date(NOW.getTime() + 4 * 3_600_000),
      new Date(NOW.getTime() + 5 * 3_600_000),
    ]);
    const { surfaced } = await engine.run(NOW);
    expect(surfaced.some((i) => i.kind === "briefing")).toBe(true);
  });

  it("flags overdue commitments", async () => {
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Call the vendor",
      new Date(NOW.getTime() - 3 * 3_600_000),
    ]);
    const { surfaced } = await engine.run(NOW);
    expect(surfaced.some((i) => i.kind === "commitment_overdue")).toBe(true);
  });

  it("detects calendar conflicts", async () => {
    await pool!.query(
      "INSERT INTO calendar_events (title, starts_at, ends_at) VALUES ($1,$2,$3),($4,$5,$6)",
      [
        "Standup", new Date(NOW.getTime() + 3_600_000), new Date(NOW.getTime() + 2 * 3_600_000),
        "1:1", new Date(NOW.getTime() + 90 * 60_000), new Date(NOW.getTime() + 150 * 60_000),
      ],
    );
    const { surfaced } = await engine.run(NOW);
    expect(surfaced.some((i) => i.kind === "calendar_conflict")).toBe(true);
  });

  it("deduplicates — the same alert does not surface twice", async () => {
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Once only",
      new Date(NOW.getTime() + 3_600_000),
    ]);
    const first = await engine.run(NOW);
    expect(first.surfaced.some((i) => i.title.includes("Once only"))).toBe(true);
    const second = await engine.run(NOW);
    expect(second.surfaced.some((i) => i.title.includes("Once only"))).toBe(false);
    expect(second.suppressed.some((s) => s.gate === "dedup")).toBe(true);
  });

  it("respects snooze and dismiss", async () => {
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Snoozable",
      new Date(NOW.getTime() + 3_600_000),
    ]);
    const c = (await engine.run(NOW)).surfaced.find((i) => i.title.includes("Snoozable"))!;
    await pool!.query("TRUNCATE proactive_items");
    await engine.snooze(c.dedupKey, new Date(NOW.getTime() + 3_600_000));
    const snoozed = await engine.run(NOW);
    expect(snoozed.surfaced.some((i) => i.title.includes("Snoozable"))).toBe(false);
    expect(snoozed.suppressed.some((s) => s.gate === "snoozed")).toBe(true);
  });

  it("honors per-domain disable", async () => {
    await engine.setDomainEnabled("work", false);
    await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'work')", [
      "Work item",
      new Date(NOW.getTime() + 3_600_000),
    ]);
    const { surfaced, suppressed } = await engine.run(NOW);
    expect(surfaced.some((i) => i.title.includes("Work item"))).toBe(false);
    expect(suppressed.some((s) => s.gate === "domain")).toBe(true);
  });

  it("never surfaces below the rate limit budget silently", async () => {
    // 6 due items, rate limit default 5/hour → 5 surface, 1 rate-limited
    for (let i = 0; i < 6; i++) {
      await pool!.query("INSERT INTO commitments (title, due_at, domain) VALUES ($1,$2,'general')", [
        `Item ${i}`,
        new Date(NOW.getTime() + (i + 1) * 30 * 60_000),
      ]);
    }
    const { surfaced, suppressed } = await engine.run(NOW);
    expect(surfaced.length).toBeLessThanOrEqual(5);
    expect(suppressed.some((s) => s.gate === "rate_limit")).toBe(true);
  });
});

describe("GateStack quiet hours + confidence (unit, DB for state only)", () => {
  afterAll(async () => {
    await pool?.end();
  });
  const quiet: GateConfig = {
    quietHours: { start: 22, end: 7 },
    confidenceThreshold: 0.5,
    rateLimit: { max: 100, windowMinutes: 60 },
    minPriority: "low",
  };

  it.skipIf(!pool)("suppresses non-critical during quiet hours but lets critical through", async () => {
    const gs = new GateStack(pool!, quiet);
    await pool!.query("TRUNCATE proactive_items, proactive_snoozes, proactive_domain_settings");
    const night = new Date("2026-07-17T03:00:00"); // 3am local
    const res = await gs.apply(
      [
        cand({ priority: "normal", title: "briefing", confidence: 0.9 }),
        cand({ priority: "critical", title: "alarm", confidence: 0.9 }),
      ],
      night,
    );
    expect(res.surfaced.map((c) => c.title)).toEqual(["alarm"]);
    expect(res.suppressed.some((s) => s.gate === "quiet_hours")).toBe(true);
  });

  it.skipIf(!pool)("drops low-confidence candidates", async () => {
    const gs = new GateStack(pool!, quiet);
    await pool!.query("TRUNCATE proactive_items, proactive_snoozes, proactive_domain_settings");
    const res = await gs.apply([cand({ confidence: 0.3, title: "unsure" })], new Date("2026-07-17T09:00:00"));
    expect(res.surfaced).toHaveLength(0);
    expect(res.suppressed[0]!.gate).toBe("confidence");
  });
});
