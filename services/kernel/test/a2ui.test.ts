import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import { A2uiSpecSchema, validateReferences } from "../src/a2ui/schema.js";
import { A2uiRegistry } from "../src/a2ui/registry.js";
import { ToolRegistry, type Tool } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { SettingsRegistry } from "../src/settings/registry.js";

/**
 * A2UI (D-0061): agent-generated declarative UI is SAFE BY CONSTRUCTION — the
 * component vocabulary is a closed whitelist (no html/script/url/iframe), and
 * every reference (setting/category/tool) must actually exist.
 */

describe("A2UI schema — whitelist enforced", () => {
  it("accepts the whitelisted components", () => {
    const spec = {
      title: "Panel",
      components: [
        { type: "heading", text: "Hi" },
        { type: "text", text: "some text" },
        { type: "setting", key: "proactive.confidenceThreshold" },
        { type: "settingsGroup", category: "Proactivity" },
        { type: "action", label: "Reset", tool: "settings.reset", args: { key: "x" } },
      ],
    };
    expect(A2uiSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("REJECTS non-whitelisted component types (html/script/iframe/url/image)", () => {
    for (const bad of ["html", "script", "iframe", "url", "link", "image"]) {
      const spec = { title: "x", components: [{ type: bad, src: "javascript:alert(1)" }] };
      expect(A2uiSpecSchema.safeParse(spec).success).toBe(false);
    }
  });

  it("validateReferences catches unknown setting/category/tool", () => {
    const spec = A2uiSpecSchema.parse({
      title: "x",
      components: [
        { type: "setting", key: "does.not.exist" },
        { type: "action", label: "go", tool: "no.such.tool" },
        { type: "settingsGroup", category: "Nope" },
      ],
    });
    const errs = validateReferences(spec, { hasSetting: () => false, hasCategory: () => false, hasTool: () => false });
    expect(errs).toHaveLength(3);
    expect(errs.join(" ")).toMatch(/unknown setting.*unknown tool.*unknown settings category/s);
  });
});

// ---- registry (DB) ----
const dbUrl = process.env.JARVIS_TEST_DATABASE_URL ?? "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try { const p = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 }); await p.query("SELECT 1"); pool = p; } catch { /* skip */ }
afterAll(async () => { await pool?.end(); });

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const settings = {
  async effective() {
    return [
      { key: "proactive.confidenceThreshold", category: "Proactivity" },
      { key: "autonomy.enabled", category: "Autonomy" },
    ];
  },
} as unknown as SettingsRegistry;
function toolReg(): ToolRegistry {
  const t = new ToolRegistry();
  t.register({ name: "settings.reset", description: "d", riskClass: "LOW_REVERSIBLE", action: "configure", inputSchema: {}, async run() { return { ok: true, summary: "" }; } } as Tool);
  return t;
}

describe.skipIf(!pool)("A2uiRegistry (D-0061) — validate + store", () => {
  beforeEach(async () => { await pool!.query("TRUNCATE ui_panels"); });

  it("stores a valid panel and rejects one with bad references", async () => {
    const reg = new A2uiRegistry(pool!, audit, settings, toolReg());
    const panel = await reg.create({
      title: "Autonomy controls",
      components: [
        { type: "heading", text: "Autonomy" },
        { type: "settingsGroup", category: "Autonomy" },
        { type: "setting", key: "proactive.confidenceThreshold" },
        { type: "action", label: "Reset confidence", tool: "settings.reset", args: { key: "proactive.confidenceThreshold" } },
      ],
    }, "jarvis");
    expect(panel.id).toBeTruthy();
    expect((await reg.list())).toHaveLength(1);

    // unknown tool → rejected (can't smuggle an action to a non-existent tool)
    await expect(reg.create({ title: "bad", components: [{ type: "action", label: "x", tool: "danger.exec" }] }, "jarvis"))
      .rejects.toThrow(/unknown tool/);
    // unknown setting key → rejected
    await expect(reg.create({ title: "bad", components: [{ type: "setting", key: "secret.dump" }] }, "jarvis"))
      .rejects.toThrow(/unknown setting/);
    // non-whitelisted component → rejected at schema
    await expect(reg.create({ title: "bad", components: [{ type: "iframe", src: "http://evil" }] }, "jarvis"))
      .rejects.toThrow(/invalid A2UI spec/);

    const id = (await reg.list())[0]!.id;
    expect(await reg.remove(id)).toBe(true);
    expect(await reg.list()).toHaveLength(0);
  });
});
