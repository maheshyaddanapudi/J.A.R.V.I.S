import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import type { WebBrowser } from "./contract.js";

/**
 * Web browsing / research tools, policy-gated (R-AUTO, R-LOC). Navigation is the
 * outward act and is CONSEQUENTIAL — `web.open` carries a pre-action disclosure,
 * is approval-gated + audited, and an out-of-policy URL (bad scheme, offline
 * external, off-allowlist) is refused as a CLEAN pre-approval denial. Reads of the
 * already-loaded page (`web.readText`/`web.links`/`web.screenshot`) are READ_ONLY;
 * form interaction (`web.fill`/`web.click`) is CONSEQUENTIAL. The read tools set
 * `detail` so the agent can actually reason over the page content.
 *
 * The backend is a REAL Chromium (PlaywrightBrowser); provenance is surfaced on
 * every call. In-container this is verified against a local page — real browser,
 * real DOM — which also honors offline/locality.
 */
export function webTools(web: WebBrowser): Tool[] {
  const open: Tool = {
    name: "web.open",
    description:
      "Navigate the browser to a URL (http/https). Consequential — reaches the network and requires approval; refused for external hosts in offline mode.",
    riskClass: "CONSEQUENTIAL",
    action: "navigate to a web page",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", description: "http(s) URL to open" } },
      required: ["url"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const { url } = args as { url: string };
      // Reject an out-of-policy target here → clean denial before approval.
      const check = web.checkTarget(url);
      if (!check.allowed) throw new Error(`refused: ${check.reason}`);
      return {
        whatWillHappen: `Open ${url} in a headless browser and load the page.`,
        affected: [url],
        proposedCommands: [`navigate → ${url}`],
        reason: "User asked J.A.R.V.I.S. to look something up on the web.",
        riskClass: "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "Navigation has no side effect on the user's machine; the page can be closed.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const { url } = args as { url: string };
      const nav = await web.open(url);
      return {
        ok: true,
        summary: `opened ${nav.url} — "${nav.title}" (HTTP ${nav.status ?? "?"}, ${nav.provenance})`,
        data: nav,
        detail: `URL: ${nav.url}\nTitle: ${nav.title}\nStatus: ${nav.status ?? "?"}`,
      };
    },
  };

  const readText: Tool = {
    name: "web.readText",
    description: "Extract the readable text of the currently-open page. Read-only.",
    riskClass: "READ_ONLY",
    action: "read web page text",
    inputSchema: {
      type: "object",
      properties: { maxChars: { type: "number", description: "cap the characters returned" } },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { maxChars } = (args ?? {}) as { maxChars?: number };
      const p = await web.readText(maxChars);
      return {
        ok: true,
        summary: `read "${p.title}" — ${p.text.length} chars${p.truncated ? " (truncated)" : ""} (${p.provenance})`,
        data: p,
        detail: `# ${p.title}\n(${p.url})\n\n${p.text}`, // the page text — what the agent researches over
      };
    },
  };

  const links: Tool = {
    name: "web.links",
    description: "List the links (text + href) on the currently-open page. Read-only.",
    riskClass: "READ_ONLY",
    action: "read web page links",
    inputSchema: {
      type: "object",
      properties: { max: { type: "number", description: "cap the number of links" } },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { max } = (args ?? {}) as { max?: number };
      const r = await web.links(max);
      return {
        ok: true,
        summary: `${r.links.length}${r.truncated ? "+" : ""} link(s) on ${r.url} (${r.provenance})`,
        data: r,
        detail: r.links.map((l) => `- ${l.text || "(no text)"} → ${l.href}`).join("\n") || "(no links)",
      };
    },
  };

  const screenshot: Tool = {
    name: "web.screenshot",
    description: "Capture a screenshot of the currently-open page. Read-only.",
    riskClass: "READ_ONLY",
    action: "capture web page",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const s = await web.screenshot();
      return {
        ok: true,
        summary: `${s.width}x${s.height} capture of ${s.url}, ${s.bytes} bytes (${s.provenance})`,
        data: s,
      };
    },
  };

  const fill: Tool = {
    name: "web.fill",
    description: "Type a value into a form field selected by CSS selector. Consequential.",
    riskClass: "CONSEQUENTIAL",
    action: "fill a web form field",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input" },
        value: { type: "string" },
      },
      required: ["selector", "value"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as { selector: string; value: string };
      return {
        whatWillHappen: `Type ${a.value.length} chars into '${a.selector}' on ${web.currentUrl() ?? "the open page"}.`,
        affected: [web.currentUrl() ?? "the open page"],
        proposedCommands: [`fill ${a.selector}`],
        reason: "User asked J.A.R.V.I.S. to fill in a web form.",
        riskClass: "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "The field can be re-filled or cleared; no submission occurs until a click.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { selector: string; value: string };
      const r = await web.fill(a.selector, a.value);
      return { ok: r.ok, summary: `${r.summary} (${r.provenance})`, data: r };
    },
  };

  const click: Tool = {
    name: "web.click",
    description: "Click an element selected by CSS selector (may submit a form or navigate). Consequential.",
    riskClass: "CONSEQUENTIAL",
    action: "click a web element",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string", description: "CSS selector of the element" } },
      required: ["selector"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as { selector: string };
      return {
        whatWillHappen: `Click '${a.selector}' on ${web.currentUrl() ?? "the open page"} (may submit or navigate).`,
        affected: [web.currentUrl() ?? "the open page"],
        proposedCommands: [`click ${a.selector}`],
        reason: "User asked J.A.R.V.I.S. to operate a web control.",
        riskClass: "CONSEQUENTIAL",
        reversible: false,
        rollbackPlan: "A click may submit/navigate irreversibly; the effect is observed after.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { selector: string };
      const r = await web.click(a.selector);
      return { ok: r.ok, summary: `${r.summary} (${r.provenance})`, data: r };
    },
  };

  return [open, readText, links, screenshot, fill, click];
}
