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
