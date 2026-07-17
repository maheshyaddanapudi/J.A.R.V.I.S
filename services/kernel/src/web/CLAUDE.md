# kernel/src/web — web browsing / research capability (Phase 2)

A **REAL** headless-browser capability (Playwright + Chromium) so J.A.R.V.I.S. can
look things up, read pages, follow links, and fill/submit forms — the Phase-2
"browser automation" + "research with provenance" pillar. Not a simulator.

This is the one capability that reaches **outward to the network**, so it is gated
tightly (R-LOC, R-AUTO): every navigation is CONSEQUENTIAL (per-navigation
approval + audit + provenance), external hosts are refused in offline mode, reads
of an already-loaded page are READ_ONLY.

## Files
- `contract.ts` — `WebBrowser` interface + result types. `checkTarget(url)` lets a
  tool's disclosure reject an out-of-policy URL as a clean pre-approval denial.
- `policy.ts` — `checkWebTarget(url, {offline, allowlist})`: only http/https;
  loopback always allowed; offline refuses external hosts; a non-empty allowlist
  restricts to configured hosts (loopback exempt). Enforced BEFORE any launch.
- `playwright.ts` — `PlaywrightBrowser` (REAL). Chromium launches **lazily** on
  first navigation (registering the tools costs nothing; an env without a browser
  fails clearly only if a web tool is used). Resolves Playwright even when the
  kernel doesn't depend on it directly (falls back to the container's global
  install); browser-side page functions are passed as strings (kept out of the
  kernel's Node-only tsconfig).
- `tools.ts` — `webTools(web)`: `web.open` (CONSEQUENTIAL — the outward act),
  `web.readText`/`web.links`/`web.screenshot` (READ_ONLY, and `readText`/`links`
  set `detail` so the agent can research over the content), `web.fill`/`web.click`
  (CONSEQUENTIAL).

## Security posture
- Per-navigation approval IS the "explicitly-configured integration" (R-LOC) — the
  user authorizes each outward navigation; standing/unattended web access (a
  session grant or an allowlist) is a heightened choice.
- Offline mode → only loopback reachable (verified). No `file://`/`data:` (no
  local-FS bypass). Page content is fed to the agent (bounded `detail`) but is
  **never** written to the audit (summary only).

## Verified (2026-07-17)
- 8 tests (`test/web.test.ts`): policy units + REAL Chromium against a local page
  through the gated loop — `web.readText`/`links` return real DOM content as
  `detail`, `web.fill`+`web.click` really change page state, a denied `web.open`
  never navigates, offline refuses an external host. Full suite **156 pass**.
- Live end-to-end: gated navigation (deny→no-nav, approve→real page + HTTP 200),
  real page text/links in `detail`, `file://`/invalid/external refused, audit
  intact with no page content in it. Harness row **P-WEB-01**.

## Real-adapter note
REAL in-container already (headless). On the Mac, install Playwright/Chromium (or
set `JARVIS_CHROMIUM_PATH`); the contract, gating, and safety flow are unchanged.
