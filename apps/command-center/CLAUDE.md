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
- **Conversation panel** at `/chat` (`app/chat/page.tsx`, 2026-07-17): text chat
  with J.A.R.V.I.S. through the REAL core loop (`POST /core/converse`, SSE read via
  a fetch stream reader — not EventSource, since it's a POST). Carries a
  `sessionId` (crypto.randomUUID) so conversation memory works across turns;
  shows the injected situational context ("what J.A.R.V.I.S. knows right now",
  from `/context`) in a disclosure; persistent e-stop aborts the in-flight stream
  AND engages the latch. No fabricated replies — tokens stream from the model via
  the kernel; a model/transport failure renders an honest error turn.
  **Verified live via headless browser (7/7)**: two turns each streamed the real
  reply token-by-token; cross-check: conversation turns persisted to
  `conversation_memory` as ciphertext (memory + encryption-at-rest through the
  UI). The verification used a local openai-compat **test model server** (real
  SSE protocol) to exercise streaming without the production models — the same
  `/core/converse` path already streams real tokens on the Mac (voice round-trip).
- **Proactivity panel** at `/proactive` (`app/proactive/page.tsx`, 2026-07-17):
  runs a cycle ON DEMAND (POST /proactive/run, optional `at` preview time) and
  shows BOTH what surfaced (with each item's "why") AND what every gate held back
  and why — the "why am I / am I not seeing this" transparency (R-PRO). Per-item
  snooze/dismiss + per-domain mute/on (POST /proactive/snooze|dismiss|domain). A
  banner states live background delivery is gated on D-0024. **Verified live via
  headless browser**: fresh cycle surfaced overdue commitments with their why +
  snooze/dismiss controls; a 3am preview suppressed all 3 via the `quiet_hours`
  gate with reasons; a re-run showed the `dedup` gate ("already surfaced"). All
  real engine output.
- **Computer-control preview** at `/control` (`app/control/page.tsx`, 2026-07-17):
  drives the labeled SIMULATION desktop (virtual Notes + Settings) through the
  REAL gated loop (POST /core/run-tool). READ actions (list apps / screenshot /
  UI tree) run immediately; CONSEQUENTIAL ones (type into a note, press Save) run
  with approve/deny and show the full disclosure → approval → execution →
  independent verification via the activity SSE "GATED PIPELINE" feed. SIMULATION
  labeled throughout; the real macOS adapter switches on only at D-0022. e-stop
  present. **Verified live (8/8)** + audit cross-check: from the UI, control.*
  actions produced policy_decision → approval_resolved (via command-center) →
  tool_call → verification with the chain intact; deny path shows a denied
  outcome. This exercises the whole macOS-control approval UX before the real
  adapter is enabled.
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
