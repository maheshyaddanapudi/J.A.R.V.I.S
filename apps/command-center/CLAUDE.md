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
- **Device-control preview** at `/devices` (`app/devices/page.tsx`, 2026-07-17):
  drives the labeled Stark-residence SIMULATION (lights, thermostat, front lock,
  garage, water valve) through the REAL gated loop. Lights/climate are
  CONSEQUENTIAL (approval); locks/garage/utilities are HIGH_RISK_PHYSICAL and show
  the full safety rule (R-AUTO-01): unlock is REFUSED without an armed interlock,
  succeeds once after `device.armInterlock` + approval, and the single-use
  interlock refuses the next unlock until re-armed. Live "GATED PIPELINE" SSE feed
  + e-stop. **Verified live (8/8)**: lights-on executed; unlock-without-interlock
  refused; arm→unlock succeeded; second unlock refused (single-use). Real HA
  gateway (same contract) binds at D-0025. NOTE: `device.armInterlock` is
  LOW_REVERSIBLE → still needs approval unless delegated, so the UI passes
  autoApprove on the arm button.
- **Self-extension Stage-A preview** at `/selfext` (`app/selfext/page.tsx`,
  2026-07-17): safely surfaces the highest-risk subsystem. Runs Stage A on a
  benign manifest (→ `awaiting_review`, explicitly NOT installed/activated) and
  on a malicious one that writes into the trust core + requests `approval:bypass`
  + hides an `eval` (→ terminally REJECTED with its protected_path /
  protected_permission / dynamic_exec violations named — hard limit R-CAP-08).
  Records capability gaps (never claims it can build them). Banner states there is
  no code path to activation; Stage B is gated on the dedicated D-0023 check-in.
  **Verified live (10/10)**: benign parked, malicious rejected with all
  violations shown, registry reflects both states, gap recorded.
- **Agent panel** at `/agent` (`app/agent/page.tsx`, 2026-07-17): give J.A.R.V.I.S.
  an objective → `POST /agent/run`; watch the multi-step plan execute in the live
  "GATED PIPELINE" feed (activity SSE). A consequential step surfaces an **inline
  approval** (polls `/core/approvals`, resolves via `/core/approvals/resolve`) so
  the blocked run unblocks WITHOUT leaving the page; the RESULT panel shows the
  step trace + final answer; persistent e-stop halts the plan. **Verified live
  (6/6)**: objective → agent called a consequential tool → paused → inline
  approval → executed → synthesized answer; the tool genuinely ran (the note file
  was written). No fabricated steps.
- **Skills panel** at `/skills` (`app/skills/page.tsx`, 2026-07-17): save named
  objectives (name + objective + max-steps), list, run, delete. Running a skill
  executes via the gated agent — a consequential step surfaces an **inline
  approval** resolved in-page; live gated-pipeline feed + result trace; e-stop.
  R-CAP-01 / D-0031. **Verified live (6/6)**: saved → listed → ran → inline
  approval → completed → deleted (the consequential step really wrote its note).
- **Files panel** at `/files` (`app/files/page.tsx`, 2026-07-17, D-0032): a real
  workspace browser/search/viewer over the **read-only** `/knowledge/*` routes
  (`/knowledge/list|read|search`), with **gated** editing through `/core/run-tool`
  (`files.edit`). Browse directories (dirs navigate, files open), search contents
  workspace-wide (file:line + preview, clickable), view a file, and propose a
  find/replace edit — a consequential edit surfaces an **inline approval** resolved
  in-page (`/core/approvals`), then the loop **independently re-reads the file** and
  the view refreshes to the verified content; live gated-pipeline SSE feed +
  persistent e-stop. This is a REAL local filesystem (not a simulator), confined to
  the workspace root. **Verified live via headless Chromium (7/7 functional; the
  only non-pass is the shared `/favicon.ico` dev 404)**: real listing + search +
  file view, and the full disclosure→approval→execute→verify edit flow (the
  approved edit really changed the file on disk and the pipeline showed
  "on-disk content matches the applied edit").
- **Memory panel** at `/memory` (`app/memory/page.tsx`, 2026-07-17, R-MEM-04): the
  user-control surface for the semantic knowledge store (D-0038) — view what
  J.A.R.V.I.S. knows about your world (entities, facts, relationships) over
  `/memory/entities[/:name]`, remember a new entity + fact through the gated loop
  (`memory.rememberEntity`/`rememberFact`, LOW_REVERSIBLE), and **forget** any
  entity (`POST /memory/entities/:name/forget`, honored in recall immediately).
  Facts are encrypted at rest; only non-secret ones ever reach conversation context
  (D-0039). Persistent e-stop. **Verified live via headless Chromium (6/6
  functional; the only non-pass is the shared `/favicon.ico` dev 404)** + kernel
  cross-check: a remembered fact really persisted, recall rendered facts/relations,
  and forget returned 404. **Now also carries the episodic TIMELINE** (D-0041): a
  live view of `GET /memory/episodes` (what happened, importance/kind/tags, relative
  time) — search the timeline (`?q=`), record a note (`memory.recordEpisode` via the
  gated loop), and **forget** any event (`POST /memory/episodes/:id/forget`).
  Consequential actions you take elsewhere appear here automatically (loop
  auto-record). Kind is shown as a text label (R-UI-02). The timeline search has a
  **"recall by meaning" toggle** (`?semantic=1`, D-0042): with an embedding model it
  ranks by cosine similarity and shows "semantic active"; without one it falls back
  to text search (labeled). **Verified live via headless Chromium (8/8 + 4/4
  semantic)**: recorded an event from the UI, search narrowed to it, the
  auto-recorded `workspace.writeNote` actions were visible, forget removed it
  immediately; by-meaning search surfaced the reactor episode for a query with no
  substring overlap; e-stop present, no console errors.
- **Terminal panel** at `/terminal` (`app/terminal/page.tsx`, 2026-07-17, D-0035): a
  REAL, workspace-scoped shell in the cinematic UI, driven through the gated loop
  (`/core/run-tool`). `terminal.inspect` (READ_ONLY safe commands) runs immediately
  and shows the **real output** (via `detail`); `terminal.run` (CONSEQUENTIAL) shows
  the full disclosure→approval→execute→verify pipeline (SSE) with approve/deny;
  dangerous/prohibited commands (a "try a dangerous command →" button runs
  `sudo rm -rf /`) are **refused outright** before any approval. Output stays local
  (never audited). Persistent e-stop. **Verified live via headless Chromium (7/7)**:
  `git status` inspected with real output, an approved `echo` ran, the dangerous
  command was refused, pipeline populated, no console errors.
- **Web panel** at `/web` (`app/web/page.tsx`, 2026-07-17, D-0034): the REAL headless
  browser (Playwright + Chromium) through the gated loop. `web.open` is the one
  OUTWARD-network act — CONSEQUENTIAL (approve/deny), and `file://`/`data:` + (in
  offline mode) external hosts are refused. `web.readText`/`links` (READ_ONLY) return
  page content **explicitly labeled UNTRUSTED EXTERNAL CONTENT** — the same content
  the model only ever sees inside an `<untrusted_external_data>` envelope (T1/D-0037).
  Live gated-pipeline feed + e-stop. **Verified live via headless Chromium (7/7)**:
  approved navigation to a loopback page returned its real text (marked untrusted),
  `file://` was refused by the scheme guard, no console errors.
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
