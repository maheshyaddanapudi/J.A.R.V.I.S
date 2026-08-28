import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { LabApplier } from "../src/lab/apply.js";
import { PromptRegistry } from "../src/prompts/registry.js";
import { SettingsRegistry } from "../src/settings/registry.js";
import { SETTINGS_CATALOG } from "../src/settings/catalog.js";
import type { LabCandidate } from "../src/lab/surface.js";

/**
 * Apply-to-live under the three-envelope rule (D-0079 Slice L4, R-LAB-06):
 * auto for unpinned whitelisted surface, explicit user approval for persona
 * and user-pinned settings, exact revert from captured prior state — all via
 * the NORMAL registries, on the real DB.
 */

const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | null = null;
try {
  pool = new pg.Pool({ connectionString: dbUrl, max: 2, connectionTimeoutMillis: 2000 });
  await pool.query("SELECT 1");
} catch {
  pool = null;
}
afterAll(async () => { await pool?.end(); });

const audit = { append: vi.fn(async () => ({})) } as never;

async function seedKept(candidate: LabCandidate, envelope: "auto" | "proposal", verdict = "keep"): Promise<string> {
  const { rows } = await pool!.query(
    `INSERT INTO lab_experiments (campaign, candidate, candidate_summary, verdict, envelope)
     VALUES ('persona-adherence', $1, $2, $3, $4) RETURNING id`,
    [JSON.stringify(candidate), candidate.summary, verdict, envelope],
  );
  return rows[0].id as string;
}

describe.skipIf(!pool)("LabApplier — three envelopes + exact revert", () => {
  let prompts: PromptRegistry;
  let settings: SettingsRegistry;
  let applier: LabApplier;
  let raises: { text: string }[] = [];

  beforeEach(async () => {
    await pool!.query("TRUNCATE lab_experiments, prompts, runtime_settings");
    raises = [];
    vi.clearAllMocks();
    prompts = new PromptRegistry(pool!, audit);
    settings = new SettingsRegistry(pool!, audit, SETTINGS_CATALOG);
    await settings.init();
    applier = new LabApplier(pool!, audit, settings, prompts, {
      raise: async (a: { text: string }) => void raises.push(a),
    });
  });

  it("auto envelope: kept judge-template applies without approval, announced with revert path", async () => {
    await prompts.set({ name: "judge-fact-consolidation", kind: "template", content: "OLD TEMPLATE" });
    const id = await seedKept(
      { summary: "clearer merge criteria", prompts: [{ name: "judge-fact-consolidation", kind: "template", content: "NEW TEMPLATE" }] },
      "auto",
    );
    const r = await applier.applyKept(id);
    expect(r.ok).toBe(true);
    expect((await prompts.get("judge-fact-consolidation", "template"))?.content).toBe("NEW TEMPLATE");
    const { rows } = await pool!.query("SELECT applied_to_live, applied_ref FROM lab_experiments WHERE id=$1", [id]);
    expect(rows[0].applied_to_live).toBe(true);
    expect(JSON.parse(rows[0].applied_ref).prior.prompts[0].content).toBe("OLD TEMPLATE");
    expect(raises.some((x) => x.text.includes("Revert any time"))).toBe(true);
  });

  it("proposal envelope (persona): refused without approval, applied with it", async () => {
    await prompts.set({ name: "butler", kind: "persona", content: "OLD PERSONA" });
    const id = await seedKept(
      { summary: "sharper persona", prompts: [{ name: "butler", kind: "persona", content: "NEW PERSONA" }] },
      "proposal",
    );
    const refused = await applier.applyKept(id);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain("requires explicit user approval");
    expect((await prompts.getActive("persona"))?.content).toBe("OLD PERSONA"); // untouched

    const ok = await applier.applyKept(id, { approvedByUser: true });
    expect(ok.ok).toBe(true);
    expect((await prompts.getActive("persona"))?.content).toBe("NEW PERSONA");
  });

  it("user-pinned setting: one night of lab evidence never clears a pin (D-0052)", async () => {
    await settings.set("proactive.confidenceThreshold", 0.9, "user", "I want it strict");
    const id = await seedKept(
      { summary: "relax confidence", settings: { "proactive.confidenceThreshold": 0.5 } },
      "auto",
    );
    const refused = await applier.applyKept(id);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain("user-pinned");
    expect(refused.reason).toContain("D-0052");

    const ok = await applier.applyKept(id, { approvedByUser: true });
    expect(ok.ok).toBe(true);
    const eff = await settings.effective();
    expect(eff.find((e) => e.key === "proactive.confidenceThreshold")?.value).toBe(0.5);
    expect(eff.find((e) => e.key === "proactive.confidenceThreshold")?.source).toBe("user"); // user approved it
  });

  it("unpinned whitelisted setting auto-applies with source jarvis; revert restores the default", async () => {
    const id = await seedKept({ summary: "longer defer", settings: { "heartbeat.deferWhileActiveMinutes": 9 } }, "auto");
    const r = await applier.applyKept(id);
    expect(r.ok).toBe(true);
    let eff = await settings.effective();
    const row = eff.find((e) => e.key === "heartbeat.deferWhileActiveMinutes");
    expect(row?.value).toBe(9);
    expect(row?.source).toBe("jarvis");

    const rev = await applier.revert(id);
    expect(rev.ok).toBe(true);
    eff = await settings.effective();
    const after = eff.find((e) => e.key === "heartbeat.deferWhileActiveMinutes");
    expect(after?.source).toBe("default"); // was default before the lab touched it
    const { rows } = await pool!.query("SELECT applied_to_live FROM lab_experiments WHERE id=$1", [id]);
    expect(rows[0].applied_to_live).toBe(false);
  });

  it("revert restores the prior persona content exactly (history preserved)", async () => {
    await prompts.set({ name: "butler", kind: "persona", content: "ORIGINAL" });
    const id = await seedKept(
      { summary: "p", prompts: [{ name: "butler", kind: "persona", content: "LAB VERSION" }] },
      "proposal",
    );
    await applier.applyKept(id, { approvedByUser: true });
    expect((await prompts.getActive("persona"))?.content).toBe("LAB VERSION");
    const rev = await applier.revert(id);
    expect(rev.ok).toBe(true);
    expect((await prompts.getActive("persona"))?.content).toBe("ORIGINAL");
    // supersede-with-history: the lab version is still in the version history
    const all = await prompts.list("persona", true);
    expect(all.some((p) => p.content === "LAB VERSION")).toBe(true);
  });

  it("only kept, unapplied experiments apply; discard/applied/missing refuse honestly", async () => {
    const discarded = await seedKept({ summary: "d", settings: { "heartbeat.maxSteps": 8 } }, "auto", "discard");
    expect((await applier.applyKept(discarded)).reason).toContain("only kept experiments");
    const id = await seedKept({ summary: "k", settings: { "heartbeat.maxSteps": 8 } }, "auto");
    await applier.applyKept(id);
    expect((await applier.applyKept(id)).reason).toBe("already applied");
    expect((await applier.applyKept("00000000-0000-0000-0000-000000000000")).reason).toBe("experiment not found");
    expect((await applier.revert(discarded)).reason).toContain("nothing to revert");
  });

  it("defense in depth: a ledger row that is no longer in LAB_SURFACE refuses at apply time", async () => {
    const id = await seedKept({ summary: "hostile", settings: { "budget.lab.nightlyTokenCap": 9e9 } }, "auto");
    const r = await applier.applyKept(id, { approvedByUser: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("no longer in LAB_SURFACE");
  });
});
