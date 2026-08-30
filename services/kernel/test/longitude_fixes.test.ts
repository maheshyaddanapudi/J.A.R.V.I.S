import { describe, expect, it, beforeEach, vi } from "vitest";
import pg from "pg";
import { MemoryService } from "../src/memory/memory.js";
import { recallPreferencesTool } from "../src/core/tools/recallPreferences.js";
import { ReasoningTuner } from "../src/core/reasoning.js";
import { JUDGE_TEMPLATES } from "../src/memory/judge.js";
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

// ---------------------------------------------------------------------------
// Longitude finding #2: agents could write preferences but never read them.
describe.skipIf(!pool)("memory.recallPreferences (Longitude #2)", () => {
  const mem = new MemoryService(pool!, audit);
  const tool = recallPreferencesTool(mem);

  beforeEach(async () => {
    await pool!.query("TRUNCATE preferences, conversation_memory");
  });

  it("returns stored preferences with values in model-facing detail", async () => {
    await mem.remember({ key: "coffee_order", value: "Espresso macchiato", provenance: "chat" });
    await mem.remember({ key: "name_preference", value: "Address the user as 'Chief'", provenance: "chat" });
    const r = await tool.run({});
    expect(r.ok).toBe(true);
    expect(r.detail).toContain("coffee_order = Espresso macchiato");
    expect(r.detail).toContain("Chief");
  });

  it("filters by query terms against keys and values", async () => {
    await mem.remember({ key: "coffee_order", value: "cortado", provenance: "chat" });
    await mem.remember({ key: "lunch_spot", value: "the noodle bar", provenance: "chat" });
    const r = await tool.run({ query: "what is my coffee order?" });
    expect(r.detail).toContain("cortado");
    expect(r.detail).not.toContain("noodle");
  });

  it("withholds private values but lists the key; excludes machinery keys", async () => {
    await mem.remember({ key: "therapist_name", value: "Dr Reyes", provenance: "chat", sensitivity: "private" });
    await mem.remember({ key: "reasoning_deep_topics", value: '["x"]', provenance: "sleep-cycle" });
    const r = await tool.run({});
    expect(r.detail).toContain("therapist_name = [value withheld — private]");
    expect(r.detail).not.toContain("Dr Reyes");
    expect(r.detail).not.toContain("reasoning_deep_topics");
  });

  it("is READ_ONLY (auto-runs in the gated loop)", () => {
    expect(tool.riskClass).toBe("READ_ONLY");
  });
});

// ---------------------------------------------------------------------------
// Longitude finding #4: routine questions forced deep must not promote topics.
describe.skipIf(!pool)("promotion calibration (Longitude #4)", () => {
  const mem = new MemoryService(pool!, audit);

  beforeEach(async () => {
    await pool!.query("TRUNCATE preferences, conversation_memory");
  });

  it("template instructs the judge to return [] for routine questions", () => {
    expect(JUDGE_TEMPLATES["judge-topic-extraction"]).toMatch(/routine everyday question/i);
    expect(JUDGE_TEMPLATES["judge-topic-extraction"]).toMatch(/empty list/i);
  });

  it("a judge returning [] (routine) accumulates nothing and never promotes", async () => {
    const judge = { extractTopics: vi.fn(async () => [] as string[]) };
    const tuner = new ReasoningTuner(mem, judge);
    expect(await tuner.recordCorrection("Should I take an umbrella if the sky looks grey?")).toEqual([]);
    expect(await tuner.recordCorrection("Should I take an umbrella if the sky looks grey?")).toEqual([]);
    expect(await tuner.recordCorrection("Should I take an umbrella if the sky looks grey?")).toEqual([]);
    expect(await tuner.topics()).toEqual([]);
  });

  it("a depth-worthy topic still promotes on the second correction", async () => {
    const judge = { extractTopics: vi.fn(async () => ["plasma containment"]) };
    const tuner = new ReasoningTuner(mem, judge);
    expect(await tuner.recordCorrection("Any thoughts on plasma containment stability margins?")).toEqual([]);
    expect(await tuner.recordCorrection("How would you tune plasma containment fields?")).toEqual([
      "plasma containment",
    ]);
    expect(await tuner.topics()).toEqual(["plasma containment"]);
  });
});

// ---------------------------------------------------------------------------
// Longitude finding #5: near-duplicate preference keys get tidied in sleep.
describe.skipIf(!pool)("preference duplicate-key tidy (Longitude #5)", () => {
  const mem = new MemoryService(pool!, audit);

  beforeEach(async () => {
    await pool!.query("TRUNCATE preferences, conversation_memory");
  });

  it("folds a same-value near-duplicate key, keeping the more specific one", async () => {
    await mem.remember({ key: "coffee_order", value: "Espresso macchiato", provenance: "chat" });
    await mem.remember({ key: "usual_coffee_order", value: "espresso macchiato", provenance: "chat" });
    const t = await mem.tidyDuplicates();
    expect(t.merged).toHaveLength(1);
    expect(t.proposals).toHaveLength(0);
    const remaining = (await mem.list()).map((p) => p.key);
    expect(remaining).toHaveLength(1); // one of the pair survives, the other soft-deleted
  });

  it("differing values on near-duplicate keys become a proposal, nothing deleted", async () => {
    await mem.remember({ key: "coffee_order", value: "cortado", provenance: "chat" });
    await mem.remember({ key: "usual_coffee_order", value: "flat white", provenance: "chat" });
    const t = await mem.tidyDuplicates();
    expect(t.merged).toHaveLength(0);
    expect(t.proposals).toHaveLength(1);
    expect((await mem.list())).toHaveLength(2);
  });

  it("distinct keys and machinery keys are untouched; pins are never tidied away", async () => {
    await mem.remember({ key: "coffee_order", value: "cortado", provenance: "chat" });
    await mem.remember({ key: "lunch_spot", value: "cortado", provenance: "chat" });
    await mem.remember({ key: "reasoning_autotune", value: "{}", provenance: "sleep-cycle" });
    await mem.remember({ key: "usual_lunch_spot", value: "cortado", provenance: "chat" });
    await mem.pin("usual_lunch_spot", true);
    const t = await mem.tidyDuplicates();
    // lunch_spot vs usual_lunch_spot are near-dups with same value, but the
    // SPECIFIC survivor by rule is the pinned one — the unpinned dup folds.
    expect(t.merged).toHaveLength(1);
    expect(t.merged[0]).toContain("usual_lunch_spot");
    const keys = (await mem.list()).map((p) => p.key);
    expect(keys).toContain("usual_lunch_spot");
    expect(keys).toContain("coffee_order");
    expect(keys).toContain("reasoning_autotune");
    expect(keys).not.toContain("lunch_spot");
  });
});
