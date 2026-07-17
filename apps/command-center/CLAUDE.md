# @jarvis/command-center — module guide

Browser Command Center (Next.js 16 + React 19; Three.js/R3F arrives with the timeline
and later modes). Everything rendered is live system data or a labeled simulator —
never decoration (R-UI-03, R-CORE-02).

## Current state
- Slice 1.1 ✅: system page polls kernel `/health`.
- Slice 1.4 ✅: Command Center shows the live trust core — kernel health, AUDIT
  panel (chain integrity + recent hash-chained entries), APPROVALS panel with
  working approve/deny (posts to /core/approvals/resolve), ACTIVITY TIMELINE via
  SSE (/core/activity), and the persistent EMERGENCY STOP button (engage/resume).
  All live data. NOTE: `page.goto` in browser tests must use
  `waitUntil: "domcontentloaded"` — the SSE activity stream means the page never
  reaches `networkidle`.
- Slice (2026-07-17): **Ambient Voice Orb** at `/orb` (`app/orb/`) — functional
  presence driven by the REAL kernel `/core/activity` SSE + `/core/estop`. States
  idle/listening/thinking/speaking/advisory/critical/stopped, each with meaningful
  animation AND a text label (never color/motion-only, R-UI-02); e-stop reachable;
  reduced-motion honored. Verified live: flipped to "Speaking" during a real model
  conversation and "Emergency stop" on a real e-stop. `?preview=<state>` inspects
  a state without driving the pipeline.
- **Operations dashboard** (2026-07-17): the system page (`app/page.tsx`) is now a
  full live operations view over the whole kernel — added panels for **context**
  (`/context` banner: part-of-day, commitments incl. OVERDUE, pending approvals,
  MCP count, e-stop), **MCP servers** (`/mcp/servers`: trust level + QUARANTINED),
  **proactive** (`/proactive/items`), and **secrets** (`/secrets`: names +
  descriptions only, "values never leave the vault"; 503 → "vault unavailable"),
  plus a link to `/orb`. Resilient per-endpoint loading (`getJson`) so one missing
  endpoint never blanks the view; health failure still shows UNREACHABLE. All data
  is real kernel state (R-UI-03/R-CORE-02). **Verified live via headless Chromium
  against a running kernel: 13/13 panel checks pass** (real MCP servers with trust
  labels, seeded commitment, stored secret by name). NOTE: Next 16 dev blocks its
  client chunks over `127.0.0.1` — load the dev UI via `localhost:<port>` (prod
  `next start` is unaffected).
- **Interactive controls** (2026-07-17): the dashboard is now a control surface,
  not just a view. SECRETS panel has a store form (POST /secrets, encrypted) +
  per-secret `forget`; MCP panel has a connect form (POST /mcp/connect) +
  per-server trust buttons untrusted/limited/trusted (POST /mcp/trust, labeled
  "re-attests on reconnect, D-0027"). All through the existing gated endpoints.
  **Verified live via headless browser (5/5) + kernel-side cross-check**: a secret
  stored (ciphertext at rest, 0 plaintext), an MCP server connected and elevated
  to trusted — all from the browser. **This surfaced a real bug** (see kernel
  CORS note): POST/DELETE from the cross-origin UI were being blocked by an
  incomplete CORS preflight — every write button (incl. approve/deny + e-stop)
  was affected until fixed.
- **Design system** proposed in `docs/DESIGN_SYSTEM.md` for the R-UI-01 check-in.
- SSE endpoints (`/core/activity`, `/core/converse`) now echo the CORS header for
  cross-origin EventSource (raw writeHead bypasses the onSend hook) — needed for
  the dev cross-port UI.
- Styling: tokens in `app/globals.css`; the visual design system is pending its
  check-in (R-UI-01) — keep visuals functional (every element communicates state).

## Conventions
- Color semantics: cyan/blue operational · amber advisory · red critical · white focal.
- Reduced-motion respected globally; every animation must communicate state (R-UI-02).
- Kernel URL: `NEXT_PUBLIC_JARVIS_KERNEL_URL` (default `http://127.0.0.1:4150`).
- Port 4160 dev/start. Localhost only (R-LOC-01).

Resume pointer: `docs/IMPLEMENTATION_PLAN.md` → Current state.
