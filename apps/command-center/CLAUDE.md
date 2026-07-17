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
- Styling: provisional tokens in `app/globals.css` only. The visual design system is
  finalized at its own check-in before slice 1.7 hardens — do not build elaborate
  visuals before that check-in (R-UI-01).

## Conventions
- Color semantics: cyan/blue operational · amber advisory · red critical · white focal.
- Reduced-motion respected globally; every animation must communicate state (R-UI-02).
- Kernel URL: `NEXT_PUBLIC_JARVIS_KERNEL_URL` (default `http://127.0.0.1:4150`).
- Port 4160 dev/start. Localhost only (R-LOC-01).

Resume pointer: `docs/IMPLEMENTATION_PLAN.md` → Current state.
