/**
 * Web browsing / research capability (Phase 2 — "browser automation (Playwright)"
 * + "research with provenance"). A typed contract over a REAL headless browser so
 * J.A.R.V.I.S. can look things up, read pages, follow links, and fill/submit forms.
 *
 * This is a REAL capability (honesty rule R-CORE-02) — it drives a real Chromium,
 * not a simulator. It is the one capability that reaches OUTWARD to the network,
 * so it is gated tightly (R-LOC, R-AUTO): every navigation is CONSEQUENTIAL
 * (per-navigation approval + audit + provenance), external hosts are refused in
 * offline mode, and reads of an already-loaded page are READ_ONLY. In-container it
 * is verified hermetically against a local page (real browser, real DOM).
 */

export type Provenance = "REAL" | "SIMULATION";

export interface NavResult {
  url: string;
  title: string;
  status: number | null;
  provenance: Provenance;
}

export interface PageText {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
  provenance: Provenance;
}

export interface LinkItem {
  text: string;
  href: string;
}

export interface PageLinks {
  url: string;
  links: LinkItem[];
  truncated: boolean;
  provenance: Provenance;
}

export interface ShotInfo {
  url: string;
  width: number;
  height: number;
  bytes: number;
  provenance: Provenance;
}

export interface WebActionResult {
  ok: boolean;
  url: string;
  summary: string;
  provenance: Provenance;
}

export interface WebTargetCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * A headless browser scoped by a network policy. `open` navigates (the outward,
 * consequential act); the rest operate on the currently-loaded page.
 */
export interface WebBrowser {
  readonly provenance: Provenance;
  /**
   * Pre-validate a navigation target against the network policy (scheme,
   * offline, allowlist) WITHOUT launching anything — lets a tool's disclosure
   * refuse an out-of-policy URL as a clean denial before approval is requested.
   */
  checkTarget(url: string): WebTargetCheck;
  open(url: string): Promise<NavResult>;
  readText(maxChars?: number): Promise<PageText>;
  links(max?: number): Promise<PageLinks>;
  screenshot(): Promise<ShotInfo>;
  fill(selector: string, value: string): Promise<WebActionResult>;
  click(selector: string): Promise<WebActionResult>;
  /** URL of the currently-loaded page, or null if nothing is open. */
  currentUrl(): string | null;
  close(): Promise<void>;
}
