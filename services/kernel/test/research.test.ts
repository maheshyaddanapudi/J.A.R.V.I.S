import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { PlaywrightBrowser } from "../src/web/playwright.js";
import { WebResearcher } from "../src/research/gather.js";
import { researchTools } from "../src/research/tools.js";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { MemoryService } from "../src/memory/memory.js";

const PAGES: Record<string, { title: string; body: string }> = {
  "/reactor": {
    title: "Arc Reactor",
    body: "<h1>Arc Reactor</h1><p>The arc reactor produces 8 megawatts of clean energy.</p><p>It uses a palladium core that degrades over time.</p><p>Weather in Malibu is sunny.</p>",
  },
  "/palladium": {
    title: "Palladium Toxicity",
    body: "<h1>Palladium</h1><p>Palladium core degradation causes blood toxicity.</p><p>A new element replaced palladium to solve the toxicity problem.</p>",
  },
};

let server: Server | undefined;
let base = "";
let browser: PlaywrightBrowser | undefined;
let chromiumOk = false;

beforeAll(async () => {
  server = createServer((req, res) => {
    const p = PAGES[req.url ?? ""];
    res.writeHead(p ? 200 : 404, { "content-type": "text/html" });
    res.end(p ? `<!doctype html><title>${p.title}</title>${p.body}` : "not found");
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  try {
    browser = new PlaywrightBrowser({ offline: false });
    await browser.open(`${base}/reactor`);
    chromiumOk = true;
  } catch {
    chromiumOk = false;
  }
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
});

describe("WebResearcher (real, provenance-tagged)", () => {
  it("checkTargets applies the web network policy without fetching", () => {
    const r = new WebResearcher(new PlaywrightBrowser({ offline: true }));
    const checks = r.checkTargets(["http://127.0.0.1:9/x", "https://example.com", "file:///etc/passwd"]);
    expect(checks[0]!.allowed).toBe(true); // loopback ok even offline
    expect(checks[1]!.allowed).toBe(false); // external refused offline
    expect(checks[2]!.allowed).toBe(false); // bad scheme
  });

  it("gathers evidence across sources, each passage tagged with its source", async () => {
    if (!chromiumOk) return;
    const r = new WebResearcher(browser!);
    const findings = await r.gather("palladium core toxicity", [`${base}/reactor`, `${base}/palladium`]);
    expect(findings.sources.filter((s) => s.ok)).toHaveLength(2);
    expect(findings.evidence.length).toBeGreaterThan(0);
    // every piece of evidence carries a real source URL + title (provenance)
    for (const e of findings.evidence) {
      expect(e.url).toContain("127.0.0.1");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.snippet.length).toBeGreaterThan(0);
    }
    // the most relevant passage should mention the queried terms and come from a real source
    const top = findings.evidence[0]!;
    expect(top.snippet.toLowerCase()).toMatch(/palladium|toxicity|core/);
    // a passage about Malibu weather (irrelevant) must not outrank the toxicity passage
    const toxicity = findings.evidence.find((e) => /toxicity/i.test(e.snippet));
    expect(toxicity).toBeDefined();
  });

  it("records a refused/failed source instead of fabricating it", async () => {
    if (!chromiumOk) return;
    const r = new WebResearcher(browser!);
    const findings = await r.gather("reactor", [`${base}/reactor`, "file:///etc/passwd"]);
    const bad = findings.sources.find((s) => s.url.startsWith("file:"));
    expect(bad?.ok).toBe(false);
    expect(bad?.error).toMatch(/scheme/i);
    // no evidence attributed to the refused source
    expect(findings.evidence.every((e) => !e.url.startsWith("file:"))).toBe(true);
  });
});

// ---- Gated loop ----
const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
function makeEstop() {
  return { get isEngaged() { return false; }, assertClear() {}, onChange() { return () => {}; } } as unknown as EmergencyStop;
}
function makeLoop(browserArg: PlaywrightBrowser) {
  const estop = makeEstop();
  const tools = new ToolRegistry();
  for (const t of researchTools(new WebResearcher(browserArg))) tools.register(t);
  return new CoreLoop({
    gateway: {} as unknown as GatewayRouter,
    policy: new PolicyEngine(audit, estop),
    tools,
    audit,
    estop,
    approvals: new ApprovalBroker(audit),
    activity: new ActivityBus(),
    memory: {} as unknown as MemoryService,
    toolCtx: { workspaceRoot: "/tmp" },
  });
}

describe("research.gather through the gated loop", () => {
  it("is CONSEQUENTIAL — approved gather returns cited evidence as detail", async () => {
    if (!chromiumOk) return;
    const loop = makeLoop(browser!);
    const res = await loop.runTool({
      tool: "research.gather",
      args: { query: "palladium toxicity", urls: [`${base}/palladium`] },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(res.ok).toBe(true);
    expect(res.detail).toMatch(/source: http:\/\/127\.0\.0\.1/); // citations present
    expect(res.detail?.toLowerCase()).toContain("toxicity");
  });

  it("denied gather never fetches", async () => {
    if (!chromiumOk) return;
    const loop = makeLoop(browser!);
    const res = await loop.runTool({
      tool: "research.gather",
      args: { query: "x", urls: [`${base}/reactor`] },
      source: "test",
      autoApprove: "deny",
    });
    expect(res.denied).toBe(true);
  });

  it("an out-of-policy source makes the whole gather a clean pre-approval denial", async () => {
    const loop = makeLoop(new PlaywrightBrowser({ offline: true }));
    const res = await loop.runTool({
      tool: "research.gather",
      args: { query: "x", urls: ["https://example.com"] },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(res.ok).toBe(false);
    expect(res.denied).toBe(true);
    expect(res.summary).toMatch(/offline|refused/i);
  });
});
