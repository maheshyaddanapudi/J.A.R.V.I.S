import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { Announcer, announceTools } from "../src/autonomy/announce.js";
import type { AuditLog } from "../src/core/audit.js";
import type { ActivityBus } from "../src/core/activity.js";
import type { SettingsRegistry } from "../src/settings/registry.js";

/**
 * Initiative to speak (D-0068): J.A.R.V.I.S. raises announcements + advisory
 * concerns; non-urgent held in quiet hours, urgent breaks through; deduped;
 * secret-redacted; a concern does not block the action.
 */
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const activity = { emit: vi.fn() } as unknown as ActivityBus;
const settings = (holdInQuiet = true) => ({
  num: async (k: string, f: number) => (k === "proactive.quietHours.start" ? 22 : k === "proactive.quietHours.end" ? 7 : f),
  bool: async (k: string, f: boolean) => (k === "announce.holdInQuietHours" ? holdInQuiet : f),
}) as unknown as SettingsRegistry;

const DAY = new Date(2026, 6, 19, 14, 0, 0);   // 14:00 — awake
const NIGHT = new Date(2026, 6, 19, 23, 30, 0); // 23:30 — quiet hours

describe.skipIf(!pool)("Announcer (D-0068) — initiative to speak", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE announcements"); });

  it("raises an announcement (awake) → immediately pending + on the timeline", async () => {
    const ann = new Announcer(pool!, audit, settings(), activity);
    const a = await ann.raise({ text: "Sir, Pepper is calling.", urgency: "info", source: "jarvis", now: DAY });
    expect(a.deferred).toBe(false);
    expect(activity.emit).toHaveBeenCalled();
    expect((await ann.pending(DAY)).map((x) => x.text)).toContain("Sir, Pepper is calling.");
  });

  it("holds NON-URGENT in quiet hours, but URGENT breaks through", async () => {
    const ann = new Announcer(pool!, audit, settings(), activity);
    await ann.raise({ text: "routine reminder", urgency: "info", source: "jarvis", now: NIGHT });
    await ann.raise({ text: "smoke detector triggered", urgency: "urgent", source: "jarvis", now: NIGHT });
    const pendingNight = (await ann.pending(NIGHT)).map((x) => x.text);
    expect(pendingNight).toContain("smoke detector triggered"); // urgent surfaces
    expect(pendingNight).not.toContain("routine reminder");     // non-urgent held
    // released once quiet hours pass
    expect((await ann.pending(DAY)).map((x) => x.text)).toContain("routine reminder");
  });

  it("dedupes repeats within the window", async () => {
    const ann = new Announcer(pool!, audit, settings(), activity);
    await ann.raise({ text: "package at the door", source: "jarvis", dedupeKey: "door-package", now: DAY });
    const second = await ann.raise({ text: "package at the door again", source: "jarvis", dedupeKey: "door-package", now: DAY });
    expect(second.suppressed).toBe("deduped");
    expect(await ann.pending(DAY)).toHaveLength(1);
  });

  it("redacts secret-shaped content before storing", async () => {
    const ann = new Announcer(pool!, audit, settings(), activity);
    const a = await ann.raise({ text: "your key is sk-ant-api03-abcdefghij1234567890", source: "jarvis", now: DAY });
    expect(a.text).not.toContain("sk-ant");
  });

  it("advise.concern voices dissent (kind=concern) WITHOUT blocking — the action is separate", async () => {
    const ann = new Announcer(pool!, audit, settings(), activity);
    const tool = announceTools(ann).find((t) => t.name === "advise.concern")!;
    const r = await tool.run({ about: "wiring the reactor to mains directly", concern: "risk of overload", recommendation: "use the step-down first" }, {} as never);
    expect(r.ok).toBe(true); // the tool succeeds — it does not deny the action
    const concerns = (await ann.list()).filter((a) => a.kind === "concern");
    expect(concerns).toHaveLength(1);
    expect(concerns[0]!.text).toMatch(/advise against wiring the reactor/);
    expect(concerns[0]!.recommendation).toMatch(/step-down/);
    expect(concerns[0]!.urgency).toBe("advisory");
  });

  it("deliver + dismiss remove an item from pending", async () => {
    const ann = new Announcer(pool!, audit, settings(), activity);
    const a = await ann.raise({ text: "one", source: "jarvis", now: DAY });
    const b = await ann.raise({ text: "two", source: "jarvis", now: DAY });
    expect(await ann.markDelivered(a.id)).toBe(true);
    expect(await ann.dismiss(b.id)).toBe(true);
    expect(await ann.pending(DAY)).toHaveLength(0);
  });
});
