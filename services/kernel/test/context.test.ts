import { describe, expect, it, beforeEach, afterAll } from "vitest";
import pg from "pg";
import { ContextService } from "../src/context/service.js";
import type { ApprovalBroker } from "../src/core/approvals.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { ContextProvider } from "../src/context/contract.js";

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

const NOW = new Date("2026-07-17T14:00:00Z"); // afternoon

function fakes(pending: { id: string; tool: string; resourceScope: string | null; createdAt: number }[], estop = false) {
  const approvals = { list: () => pending } as unknown as ApprovalBroker;
  const emergencyStop = { isEngaged: estop } as unknown as EmergencyStop;
  return { approvals, estop: emergencyStop };
}

afterAll(async () => {
  await pool?.end();
});

describe.skipIf(!pool)("ContextService (situational awareness)", () => {
  beforeEach(async () => {
    await pool!.query("TRUNCATE commitments, proactive_items, preferences");
  });

  it("aggregates commitments (overdue vs due-soon vs upcoming) from real rows", async () => {
    await pool!.query(
      `INSERT INTO commitments (title, due_at, domain, status) VALUES
        ('Call Pepper', $1, 'work', 'open'),
        ('Review suit telemetry', $2, 'work', 'open'),
        ('Dentist', $3, 'personal', 'open'),
        ('Done thing', $1, 'work', 'done')`,
      [
        new Date(NOW.getTime() - 3600_000).toISOString(), // overdue (1h ago)
        new Date(NOW.getTime() + 1800_000).toISOString(), // due soon (30m)
        new Date(NOW.getTime() + 86_400_000).toISOString(), // upcoming (1d)
      ],
    );
    const { approvals, estop } = fakes([]);
    const ctx = new ContextService({ pool: pool!, approvals, estop });
    const s = await ctx.snapshot(NOW);
    expect(s.partOfDay).toBe("afternoon");
    const byTitle = Object.fromEntries(s.commitments.map((c) => [c.title, c]));
    expect(byTitle["Call Pepper"]!.overdue).toBe(true);
    expect(byTitle["Review suit telemetry"]!.dueSoon).toBe(true);
    expect(byTitle["Dentist"]!.overdue).toBe(false);
    expect(byTitle["Dentist"]!.dueSoon).toBe(false);
    expect(byTitle["Done thing"]).toBeUndefined(); // done commitments excluded
  });

  it("includes unacknowledged proactive items and pending approvals; reflects e-stop", async () => {
    await pool!.query(
      `INSERT INTO proactive_items (kind, priority, domain, title, detail, confidence, why, dedup_key, acknowledged)
       VALUES ('deadline_due','high','work','Battery low','detail',0.9,'why','k1', false),
              ('briefing','low','general','Old news','detail',0.5,'why','k2', true)`,
    );
    const { approvals, estop } = fakes(
      [{ id: "a1", tool: "device.set", resourceScope: null, createdAt: Date.now() }],
      true,
    );
    const ctx = new ContextService({ pool: pool!, approvals, estop, mcpCount: () => 3 });
    const s = await ctx.snapshot(NOW);
    expect(s.proactive.map((p) => p.title)).toEqual(["Battery low"]); // acknowledged one excluded
    expect(s.pendingApprovals).toEqual({ count: 1, tools: ["device.set"] });
    expect(s.emergencyStop).toBe(true);
    expect(s.mcpServers).toBe(3);

    const text = await ctx.describe(NOW);
    expect(text).toMatch(/reference only/i);
    expect(text).toMatch(/EMERGENCY STOP/);
    expect(text).toMatch(/Battery low/);
    expect(text).toMatch(/awaiting your approval/);
  });

  it("includes non-sensitive pinned preferences but NEVER private/secret ones", async () => {
    await pool!.query(
      `INSERT INTO preferences (key, value, sensitivity, pinned, status, provenance) VALUES
        ('coffee_order','flat white','personal', true, 'user_statement', 'user'),
        ('home_addr','1 Stark Tower','private', true, 'user_statement', 'user'),
        ('vault_pin','1234','secret', true, 'user_statement', 'user'),
        ('not_pinned','x','personal', false, 'user_statement', 'user')`,
    );
    const { approvals, estop } = fakes([]);
    const ctx = new ContextService({ pool: pool!, approvals, estop });
    const s = await ctx.snapshot(NOW);
    expect(s.pinnedFacts.map((f) => f.key)).toEqual(["coffee_order"]);
    const text = await ctx.describe(NOW);
    expect(text).toMatch(/flat white/);
    expect(text).not.toMatch(/Stark Tower/);
    expect(text).not.toMatch(/1234/);
  });

  it("folds in optional providers and labels non-REAL provenance; a failing provider is ignored", async () => {
    const { approvals, estop } = fakes([]);
    const good: ContextProvider = { key: "focusedApp", provenance: "REAL", get: async () => "Xcode" };
    const inferred: ContextProvider = { key: "mood", provenance: "INFERRED", get: async () => "focused" };
    const broken: ContextProvider = { key: "boom", provenance: "REAL", get: async () => { throw new Error("nope"); } };
    const ctx = new ContextService({ pool: pool!, approvals, estop }, [good, inferred, broken]);
    const s = await ctx.snapshot(NOW);
    expect(s.extra.focusedApp).toBe("Xcode");
    expect(s.extra.mood).toBe("focused (INFERRED)");
    expect(s.extra.boom).toBeUndefined();
  });

  it("degrades gracefully with nothing notable", async () => {
    const { approvals, estop } = fakes([]);
    const ctx = new ContextService({ pool: pool!, approvals, estop });
    const text = await ctx.describe(NOW);
    expect(text).toMatch(/Nothing else notable/);
  });
});
