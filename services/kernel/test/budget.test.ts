import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { Budget } from "../src/core/budget.js";
import type { SettingsRegistry } from "../src/settings/registry.js";

/**
 * Spend governance (D-0066): autonomy is metered against a token cap; a live
 * turn is NEVER blocked. Meters from the real model_calls audit by source.
 */
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });

function settings(caps: { autonomy: number; daily: number }): SettingsRegistry {
  return {
    num: async (k: string, f: number) =>
      k === "budget.autonomy.dailyTokenCap" ? caps.autonomy : k === "budget.dailyTokenCap" ? caps.daily : f,
  } as unknown as SettingsRegistry;
}
async function seed(model: string, source: string, inTok: number, outTok: number) {
  await pool!.query(
    `INSERT INTO model_calls (role, provider, model, privacy_class, source, ok, input_tokens, output_tokens)
     VALUES ('fast_conversation','anthropic',$1,'STANDARD',$2,true,$3,$4)`,
    [model, source, inTok, outTok],
  );
}

describe.skipIf(!pool)("Budget (D-0066) — spend governance", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE model_calls"); });

  it("splits interactive vs autonomy spend and estimates USD from the price table", async () => {
    await seed("claude-haiku-4-5", "chat", 1_000_000, 200_000);      // interactive: $1 + $1 = $2
    await seed("claude-haiku-4-5", "heartbeat", 100_000, 20_000);    // autonomy
    const b = new Budget(pool!, settings({ autonomy: 0, daily: 0 }));
    const s = await b.status();
    expect(s.interactive.tokens).toBe(1_200_000);
    expect(s.autonomy.tokens).toBe(120_000);
    expect(s.interactive.usd).toBeCloseTo(2, 5);
    expect(s.total.tokens).toBe(1_320_000);
  });

  it("allowAutonomy BLOCKS when the autonomy cap is exceeded, with a reason", async () => {
    await seed("claude-sonnet-5", "heartbeat", 400_000, 200_000); // 600k autonomy tokens
    const b = new Budget(pool!, settings({ autonomy: 500_000, daily: 0 }));
    const r = await b.allowAutonomy();
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/autonomy token cap reached/);
    expect(r.status.autonomyExhausted).toBe(true);
    expect(r.status.autonomyRemaining).toBe(0);
  });

  it("a live INTERACTIVE turn does not count against the autonomy cap (never locks the user out)", async () => {
    await seed("claude-sonnet-5", "chat", 5_000_000, 1_000_000); // huge interactive spend
    const b = new Budget(pool!, settings({ autonomy: 500_000, daily: 0 }));
    const r = await b.allowAutonomy();
    expect(r.allowed).toBe(true);            // interactive spend doesn't exhaust autonomy
    expect(r.status.autonomy.tokens).toBe(0);
  });

  it("overall daily cap pauses autonomy (but is not the autonomy cap)", async () => {
    await seed("claude-haiku-4-5", "chat", 9_000_000, 1_000_000);   // 10M interactive
    await seed("claude-haiku-4-5", "heartbeat", 100_000, 0);        // small autonomy
    const b = new Budget(pool!, settings({ autonomy: 0, daily: 10_000_000 }));
    const r = await b.allowAutonomy();
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/daily token cap reached/);
  });

  it("0 caps = unlimited (never blocks)", async () => {
    await seed("claude-opus-4-8", "heartbeat", 50_000_000, 10_000_000);
    const b = new Budget(pool!, settings({ autonomy: 0, daily: 0 }));
    expect((await b.allowAutonomy()).allowed).toBe(true);
  });
});
