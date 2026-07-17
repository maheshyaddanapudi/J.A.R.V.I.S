import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { checkWebTarget } from "../src/web/policy.js";
import { PlaywrightBrowser } from "../src/web/playwright.js";
import { webTools } from "../src/web/tools.js";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus } from "../src/core/activity.js";
import { ToolRegistry } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { MemoryService } from "../src/memory/memory.js";

// ---- Network policy (pure — no browser) ----
describe("web network policy (checkWebTarget)", () => {
  it("allows http/https and rejects other schemes + invalid URLs", () => {
    expect(checkWebTarget("https://example.com", { offline: false }).allowed).toBe(true);
    expect(checkWebTarget("file:///etc/passwd", { offline: false }).allowed).toBe(false);
    expect(checkWebTarget("data:text/html,hi", { offline: false }).allowed).toBe(false);
    expect(checkWebTarget("not a url", { offline: false }).allowed).toBe(false);
  });
  it("offline mode allows loopback but refuses external hosts", () => {
    expect(checkWebTarget("http://127.0.0.1:8080/x", { offline: true }).allowed).toBe(true);
    expect(checkWebTarget("http://localhost/x", { offline: true }).allowed).toBe(true);
    const ext = checkWebTarget("https://example.com", { offline: true });
    expect(ext.allowed).toBe(false);
    expect(ext.reason).toMatch(/offline/i);
  });
  it("enforces an allowlist (loopback always exempt)", () => {
    const opts = { offline: false, allowlist: ["example.com"] };
    expect(checkWebTarget("https://example.com/a", opts).allowed).toBe(true);
    expect(checkWebTarget("https://docs.example.com/a", opts).allowed).toBe(true); // subdomain
    expect(checkWebTarget("https://evil.test/a", opts).allowed).toBe(false);
    expect(checkWebTarget("http://127.0.0.1/a", opts).allowed).toBe(true);
  });
});

// ---- Real browser + gated loop (needs Chromium; skips if unavailable) ----
const PAGE = `<!doctype html><html><head><title>Arc Reactor Docs</title></head><body>
<h1>Arc Reactor</h1>
<p>The current output is 8 megawatts. TODO recalibrate the telemetry.</p>
<a href="/specs">Specifications</a><a href="/safety">Safety</a>
<form><input id="q" name="q"><button id="go" type="button">Go</button></form>
<div id="result"></div>
<script>document.getElementById('go').addEventListener('click',function(){
  document.getElementById('result').textContent='SEARCHED:'+document.getElementById('q').value;});</script>
</body></html>`;

let server: Server | undefined;
let base = "";
let browser: PlaywrightBrowser | undefined;
let chromiumOk = false;

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(PAGE);
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  try {
    browser = new PlaywrightBrowser({ offline: false });
    await browser.open(`${base}/`); // probe: launches Chromium
    chromiumOk = true;
  } catch {
    chromiumOk = false; // Chromium not available — skip the integration suite
  }
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
});

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
function makeEstop() {
  return { get isEngaged() { return false; }, assertClear() {}, onChange() { return () => {}; } } as unknown as EmergencyStop;
}
function makeLoop(web: PlaywrightBrowser) {
  const estop = makeEstop();
  const tools = new ToolRegistry();
  for (const t of webTools(web)) tools.register(t);
  const loop = new CoreLoop({
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
  return loop;
}

describe("PlaywrightBrowser (REAL Chromium) through the gated loop", () => {
  it("reads real page text via web.readText (detail carries the content)", async () => {
    if (!chromiumOk) return; // browser unavailable in this env
    const loop = makeLoop(browser!);
    // web.open is CONSEQUENTIAL — approve it; readText is READ_ONLY.
    const opened = await loop.runTool({ tool: "web.open", args: { url: `${base}/` }, source: "test", autoApprove: "allow-once" });
    expect(opened.ok).toBe(true);
    const read = await loop.runTool({ tool: "web.readText", args: {}, source: "test" });
    expect(read.ok).toBe(true);
    expect(read.detail).toContain("8 megawatts"); // real DOM text reached the agent-facing detail
    expect(read.detail).toContain("Arc Reactor");
  });

  it("extracts links via web.links", async () => {
    if (!chromiumOk) return;
    const loop = makeLoop(browser!);
    await loop.runTool({ tool: "web.open", args: { url: `${base}/` }, source: "test", autoApprove: "allow-once" });
    const links = await loop.runTool({ tool: "web.links", args: {}, source: "test" });
    expect(links.ok).toBe(true);
    expect(links.detail).toContain("/specs");
    expect(links.detail).toContain("/safety");
  });

  it("fills a field and clicks a button — the page state really changes", async () => {
    if (!chromiumOk) return;
    const loop = makeLoop(browser!);
    await loop.runTool({ tool: "web.open", args: { url: `${base}/` }, source: "test", autoApprove: "allow-once" });
    await loop.runTool({ tool: "web.fill", args: { selector: "#q", value: "palladium" }, source: "test", autoApprove: "allow-once" });
    await loop.runTool({ tool: "web.click", args: { selector: "#go" }, source: "test", autoApprove: "allow-once" });
    const read = await loop.runTool({ tool: "web.readText", args: {}, source: "test" });
    expect(read.detail).toContain("SEARCHED:palladium"); // fill + click really operated the page
  });

  it("web.open denied means no navigation happens", async () => {
    if (!chromiumOk) return;
    const fresh = new PlaywrightBrowser({ offline: false });
    try {
      const loop = makeLoop(fresh);
      const res = await loop.runTool({ tool: "web.open", args: { url: `${base}/` }, source: "test", autoApprove: "deny" });
      expect(res.denied).toBe(true);
      expect(fresh.currentUrl()).toBeNull(); // the gate stopped it — Chromium never navigated
    } finally {
      await fresh.close();
    }
  });

  it("offline mode refuses an external host as a clean pre-approval denial", async () => {
    const offlineBrowser = new PlaywrightBrowser({ offline: true });
    const loop = makeLoop(offlineBrowser);
    const res = await loop.runTool({
      tool: "web.open",
      args: { url: "https://example.com" },
      source: "test",
      autoApprove: "allow-once", // even with approval, the policy refuses first
    });
    expect(res.ok).toBe(false);
    expect(res.denied).toBe(true);
    expect(res.summary).toMatch(/offline/i);
    await offlineBrowser.close();
  });
});
