import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type {
  NavResult,
  PageLinks,
  PageText,
  ShotInfo,
  WebActionResult,
  WebBrowser,
  WebTargetCheck,
} from "./contract.js";
import { checkWebTarget, type WebPolicyOptions } from "./policy.js";

const NAV_TIMEOUT = 15_000;
const ACTION_TIMEOUT = 5_000;

/**
 * REAL headless-browser adapter backed by Playwright + Chromium. Launch is LAZY —
 * Chromium is only started on the first navigation, so registering the web tools
 * costs nothing and an environment without a browser fails with a clear message
 * only if a web tool is actually used. Every navigation is policy-checked first
 * (offline / allowlist / scheme). Fully real; verified in-container against a
 * local page.
 */
export class PlaywrightBrowser implements WebBrowser {
  readonly provenance = "REAL" as const;
  private readonly opts: WebPolicyOptions;
  private browser: unknown = null;
  private page: unknown = null;
  private url: string | null = null;

  constructor(opts: WebPolicyOptions) {
    this.opts = opts;
  }

  checkTarget(url: string): WebTargetCheck {
    return checkWebTarget(url, this.opts);
  }

  private async ensurePage(): Promise<Record<string, (...a: unknown[]) => Promise<unknown>>> {
    if (this.page) return this.page as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const chromium = await loadChromium();
    const launchOpts: Record<string, unknown> = { headless: true, args: ["--no-sandbox"] };
    const exe = resolveChromiumPath();
    if (exe) launchOpts.executablePath = exe;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.browser = await (chromium as any).launch(launchOpts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await (this.browser as any).newContext();
    this.page = await context.newPage();
    return this.page as Record<string, (...a: unknown[]) => Promise<unknown>>;
  }

  async open(url: string): Promise<NavResult> {
    const check = this.checkTarget(url);
    if (!check.allowed) throw new Error(`refused: ${check.reason}`);
    const page = await this.ensurePage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await (page as any).goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.url = (page as any).url();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title = await (page as any).title();
    return { url: this.url ?? url, title, status: resp ? resp.status() : null, provenance: "REAL" };
  }

  private requireOpen(): Record<string, (...a: unknown[]) => Promise<unknown>> {
    if (!this.page) throw new Error("no page open — call web.open first");
    return this.page as Record<string, (...a: unknown[]) => Promise<unknown>>;
  }

  async readText(maxChars = 8000): Promise<PageText> {
    const page = this.requireOpen();
    // The page function runs in Chromium (not Node); pass it as a string so the
    // kernel's tsconfig (no DOM lib) doesn't try to type its DOM references.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = String(await (page as any).evaluate("document.body ? document.body.innerText : ''"));
    const text = raw.replace(/\n{3,}/g, "\n\n").trim();
    const truncated = text.length > maxChars;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title = await (page as any).title();
    return {
      url: this.url ?? "",
      title,
      text: truncated ? text.slice(0, maxChars) : text,
      truncated,
      provenance: "REAL",
    };
  }

  async links(max = 100): Promise<PageLinks> {
    const page = this.requireOpen();
    // Evaluated as a string in Chromium (keeps DOM types out of the kernel's
    // Node-only tsconfig; `page.evaluate` reliably accepts a string expression).
    const expr =
      "Array.from(document.querySelectorAll('a[href]')).map(function(e){return {text:(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120),href:e.href};})";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (await (page as any).evaluate(expr)) as { text: string; href: string }[];
    const truncated = all.length > max;
    return { url: this.url ?? "", links: all.slice(0, max), truncated, provenance: "REAL" };
  }

  async screenshot(): Promise<ShotInfo> {
    const page = this.requireOpen();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = (await (page as any).screenshot()) as Buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vp = (page as any).viewportSize() as { width: number; height: number } | null;
    return {
      url: this.url ?? "",
      width: vp?.width ?? 0,
      height: vp?.height ?? 0,
      bytes: buf.length,
      provenance: "REAL",
    };
  }

  async fill(selector: string, value: string): Promise<WebActionResult> {
    const page = this.requireOpen();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page as any).fill(selector, value, { timeout: ACTION_TIMEOUT });
    return { ok: true, url: this.url ?? "", summary: `filled '${selector}' (${value.length} chars)`, provenance: "REAL" };
  }

  async click(selector: string): Promise<WebActionResult> {
    const page = this.requireOpen();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page as any).click(selector, { timeout: ACTION_TIMEOUT });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.url = (page as any).url();
    return { ok: true, url: this.url ?? "", summary: `clicked '${selector}'`, provenance: "REAL" };
  }

  currentUrl(): string | null {
    return this.url;
  }

  async close(): Promise<void> {
    if (this.browser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.browser as any).close();
      this.browser = null;
      this.page = null;
      this.url = null;
    }
  }
}

/** Resolve the Playwright module, tolerating the kernel not depending on it directly. */
async function loadChromium(): Promise<unknown> {
  let mod: Record<string, unknown>;
  // Widened specifier so tsc doesn't try to resolve a module the kernel doesn't
  // depend on directly (it's resolved at runtime; the fallback covers the container).
  const spec: string = "playwright";
  try {
    mod = (await import(spec)) as Record<string, unknown>;
  } catch {
    const fallback = process.env.JARVIS_PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright/index.js";
    if (!existsSync(fallback)) {
      throw new Error(
        "web capability requires Playwright — install it (`pnpm add playwright`) or set JARVIS_PLAYWRIGHT_PATH",
      );
    }
    mod = (await import(pathToFileURL(fallback).href)) as Record<string, unknown>;
  }
  const chromium = (mod.chromium ?? (mod.default as Record<string, unknown> | undefined)?.chromium) as unknown;
  if (!chromium) throw new Error("Playwright loaded but chromium export was not found");
  return chromium;
}

/** Prefer an explicit Chromium binary if one is known; otherwise let Playwright resolve it. */
function resolveChromiumPath(): string | undefined {
  const explicit = process.env.JARVIS_CHROMIUM_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  const container = "/opt/pw-browsers/chromium";
  if (existsSync(container)) return container;
  return undefined;
}
