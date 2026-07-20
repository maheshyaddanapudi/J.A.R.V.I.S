# Fresh full observation run — 70/30, real brain, un-seeded heartbeats/quiet-hours

**Date:** 2026-07-20 · **Brain:** real Anthropic (Haiku `fast_conversation` / Sonnet-5
`deep_reasoning`) · fresh factory-state `jarvis_fresh` DB, built from a clean
`git status` clean tree (post D-0075 + cross-kind resolution). A full first-time
re-run of the 70/30 observation methodology, this time with **zero seeded
heartbeat/agenda/quiet-hours data** — every heartbeat tick, every consolidation,
every announcement came from the real `BackgroundScheduler` acting on real,
legitimately-configured settings (autonomy on, 2-minute interval, `every-tick`
brain, `STANDARD` heartbeat privacy — all normal user-facing settings operations,
not database seeding).

## Volume
73 breadth conversations (51 unique / 22 repeated, **30.1% repeated** — hits the
70/30 target precisely), every conversation multi-turn (3 turns each, 219 turns
total, 100% answered). 45 memory-recording entities via the agent path (40
unique / 5 recurring, 96 memory tool calls) plus 2 deliberate cross-kind
scenarios. 3 forced deep-reasoning corrections. Two self-authored skills. Total
session: **633 model calls, ~1.82M tokens, ~$2.26 spend**, over roughly 45
minutes wall-clock. 450 conversation turns, 55 entity rows (34 active), 48 fact
rows (40 active), 1000 audit entries (chain intact), 20 heartbeats, 4
announcements — all in the DB, all real.

## 1. Memory recording + duplicates
- **Duplicates observed and correctly resolved, live, via the D-0075 fast-model
  judge — 20 `memory-entity-resolution` calls, all successful (Haiku), 17 of
  which matched an existing entity** (3 declined and created new entities,
  correctly). Real cross-session name-variant collapses seen in the audit trail:
  `'Mark 42' → 'Mark 42 suit'`, `'Pepper' → 'Pepper Potts'`, `'workshop'` /
  `'Malibu house'` / `"user's workshop"` all converging on canonical **"Malibu
  house basement workshop"** (the fullest name won every time, regardless of
  which variant arrived first — the D-0075 fuller-name-as-canonical fix holding
  up under real, uncoordinated model naming), and `'user'`/`'User'` → **"the
  user"**. None of these entity names were dictated by my test scripts — the
  model chose its own wording for each fact, and the judge reconciled them.
- **Cross-kind scenarios**: seeded "Project Insight" (framed once as "a
  project", once as "a thing/device") landed as a **single** entity — either the
  exact-match path or the judge caught it before any duplicate could form.
  "Extremis" (three separate mentions across a unique-fact call plus two
  cross-kind-framed calls) settled to **one active + one superseded** row (both
  kind `thing`, since the model didn't literally vary the kind argument on my
  soft natural-language hints — a limitation of my test's phrasing, not of the
  resolver). Net: **zero cross-kind healing was needed** in `memory-entity-consolidation`
  (0 calls) because **prevention on write handled every case** — a genuinely
  positive result, though it means this run didn't newly re-prove the *healing*
  path (already proven in the dedicated D-0075 verification with a seeded
  pre-existing duplicate).
- **Fact-merge consolidation**: 87 `memory-fact-consolidation` judge calls
  (Haiku, 100% success) across the run's heartbeat ticks; two ticks reported
  real merges (`duplicatesMerged: 3` and `4`, `entitiesScanned: 34` each).
  Facts also correctly migrate forward through ordinary same-kind supersession
  (the "arc reactor" recurring chain: 4 mentions → 3 superseded + 1 active, all
  facts preserved on the live entity — the original fragmentation-fix behavior,
  still solid).
- **Read-then-write correction** exercised naturally: an agent objective ("flag
  the arc reactor's palladium-free update") led J.A.R.V.I.S. to `memory.recall`
  → `memory.correct` (superseding 1 prior fact, kept as history) on its own,
  unprompted.
- **Encryption at rest: 0 plaintext** across all 40 active facts and all 450
  conversation turns (`v1.gcm.*` throughout).

## 2. Announcements outside quiet hours
Both branches observed for real, on the **real default quiet-hours window
(22–7 UTC)**, which happened to include the actual test time (~01:00–01:42 UTC)
— no artificial clock manipulation needed for the first branch:
- **Genuinely autonomous announcement**: at **01:20:58**, roughly 16 minutes
  after autonomy was enabled and **before I had asked about it in any way**,
  J.A.R.V.I.S. used `notify.announce` on its own to flag that its embeddings
  provider (`ollama/nomic-embed-text`) had been failing repeatedly during
  sleep-cycle consolidation — genuine, unprompted initiative-to-speak about a
  real operational problem it noticed in its own record. **Deferred** (still
  quiet hours), `urgency: advisory`.
- A second, explicitly-requested `notify.announce` (asking it to "flag [the
  embedding issue] properly... even if I'm away") also **deferred** — same
  quiet-hours window.
- `advise.concern` fired when asked to note a plan to "disable all sleep to
  work nonstop in the workshop for several days" — real advisory dissent,
  pushing back before offering to just log the plan as asked. Recorded
  **deferred**, `urgency: advisory`.
- After toggling `proactive.quietHours` to a window that **excludes** the
  current time (a normal settings change, exactly how a user would set their
  own quiet hours — not data seeding), a fourth `notify.announce` (the arc
  reactor update) surfaced **immediately** (`deferred: false`). All four rows
  confirmed in the `announcements` table with correct `kind`/`urgency`/`deferred`
  columns.

## 3. Behavioral drift from factory
- Factory baseline (recorded before any activity): **0 learned topics**,
  autotune threshold **2**, source `default`; 0 entities/facts/conversation
  turns/heartbeats/skills/capabilities.
- After the run: `["palladium metallurgy", "repulsor thrust dynamics", "arc
  reactor thermodynamics"]` — **all three multi-word phrases, verbatim,
  with zero filler** ("quick", "one-line" never appear). Confirmed via 6
  successful `reasoning-topic-extraction` calls (Haiku) — this is the D-0075
  fast-model extractor, not the old heuristic. Autotune threshold unchanged
  (2, still default) — no unintended drift elsewhere.

## 4. Heartbeats accepted vs not executed
- **20 heartbeats total** (2-minute interval, `every-tick` brain). Of the first
  17 sampled in detail: **4 deferred** (`"deferred — live session active"`,
  during the busy breadth+memory-recording window, 01:06–01:12) and **13
  executed** with a real Haiku brain pass.
- **Genuine discovery**: the defer/un-defer pattern reveals that
  `lastUserActivityAt` (which gates `heartbeat.deferWhileActiveMinutes`) tracks
  **only the conversational `/core/converse` path** — not `/agent/run`,
  `/core/run-tool`, or `/core/approvals/resolve`. Heartbeats kept firing
  un-deferred (`brain_used: true`) throughout ~24 minutes of continuous agent
  and tool-call activity on my end, the moment the chat-path traffic (breadth.py)
  stopped. Worth a source-level confirmation if this distinction should be
  surfaced to the user (right now it's invisible — "the user is active" reads
  differently depending on which interface they're using).
- **No consequential action was ever proposed on any heartbeat** in this run —
  every non-deferred tick found "no pending agenda, no active projects, nothing
  perceivable" and said so honestly, never manufacturing busywork. This is the
  **correct, non-hallucinatory** behavior for a genuinely idle, un-seeded
  environment (in deliberate contrast to the *prior* observation run, which
  used a **planted** consequential trap — not repeated here per your earlier
  correction against seeding). The consequence: this run has **no fresh evidence
  of the heartbeat approval-ceiling auto-denying a real consequential action** —
  that mechanism was already verified in D-0064's dedicated test and the prior
  observation run; it just had nothing to exercise it here.

## 5. Quiet-hours consolidation
- Ran on every non-deferred tick (`runSleepCycle` default on,
  `sleep.useQuietHours=false` by default so it isn't confined to the
  quiet-hours window — consolidation ran identically before and after the
  quiet-hours toggle). Two sampled ticks show real merges: `duplicatesMerged: 3`
  then `4`, `entitiesScanned: 34` both times — via the D-0075 fast-model judge
  (87 `memory-fact-consolidation` calls total across the run, 100% success).
- Cross-kind healing (`memory-entity-consolidation`) never fired — see
  dimension 1; prevention handled it live.

## 6. Self-created skill (MD) vs self-written code
Both demonstrated from **open-ended prompts that never named a tool**:
- **No-code skill**: asked to make "checking system status" reusable →
  J.A.R.V.I.S. called `skill.save` itself → **"system status check"**
  (composes `system.info`/`control_listApps`/`device_list`, all READ_ONLY).
  Later `skill.run` executed it cleanly in 3 steps, no approval friction (no
  consequential steps inside).
- **Code-backed skill**: asked to compute Fibonacci numbers and make it
  reusable → J.A.R.V.I.S. wrote a real `fibonacci.py` (verified correct: F(20)=
  6765 … F(25)=75025), ran it via `terminal.run` (REAL, exit 0), and called
  `skill.save` itself → **"compute_fibonacci"**. Re-running this skill later
  **regenerated similar code from the stored objective rather than replaying
  the exact saved file** — an honest nuance: skill reuse means reusing the
  *task*, not necessarily the literal artifact.
- **Formal capability authoring, attempted and honestly explained**: asked to
  register the Fibonacci program as a formal capability (not just a skill),
  J.A.R.V.I.S. tried `selfext.draft` but used a **malformed tool name
  (`terminal_run` instead of `terminal.run`)** — correctly **rejected** by the
  R-CAP-08 guard (`"unknown tool 'terminal_run' — compose only tools you
  actually have"`). Rather than silently failing or claiming success,
  J.A.R.V.I.S. gave an accurate explanation of the real constraint
  ("I can only compose existing gated tools... the Fibonacci program is a
  file-based asset, not a gated tool itself") and offered the skill path
  instead. Net: the model made a real mistake; the system's guard caught it;
  J.A.R.V.I.S.'s own explanation was honest rather than confabulated. `selfext/active`
  confirms **0 active capabilities** — consistent, nothing was silently activated.

## 7. Everything else (including two genuine bugs found)
- **Butler persona** held across all 73 breadth conversations (butler-marker
  phrases in 104/219 turns, 47%). **100% answer rate.** Audit chain **intact**
  across 1000 entries. Spend metering accurate (`$2.2645` total, `$2.0124`
  interactive / `$0.2521` autonomy, neither cap exhausted).
- **Bug found and fixed: `ops.health()`'s episode count was silently always
  zero.** It filtered `WHERE status = 'active'`, but `memory_episodes.status`
  uses the shared `epistemic_status` enum (`verified_fact`, `user_statement`,
  `external_claim`, `inferred_preference`, `temporary_context`, `simulated_data`,
  `uncertain`, `superseded`, `deleted`) — **there is no `'active'` value in that
  enum, anywhere in the codebase**. Despite 28 real episodes existing in this
  run's DB, `/ops/health` reported `episodes: 0`. Fixed to
  `status NOT IN ('deleted','superseded')` (the same pattern used everywhere
  else for entities/facts). Regression test added
  (`test/ops.test.ts`: seeds one active + one deleted episode, asserts the
  count is 1 — would have failed before the fix). 384 kernel tests now pass
  (was 383).
- **Real operational finding (not a code bug, an architecture trap for raw API
  callers): a consequential step inside a re-invoked skill/agent run can block
  its calling HTTP request indefinitely, with no timeout.** `skill.run`
  deliberately does not propagate the caller's `autoApprove` into the skill's
  *dynamic* inner steps (each gates independently, safer than a pre-reviewed
  Stage-B composition). When I called `compute_fibonacci` via raw
  `/core/run-tool`, its first `workspace.writeNote` step created a pending
  approval that nothing ever resolved — the request hung for **25+ minutes**,
  confirmed genuinely stuck (not slow) by cross-checking the kernel's request
  log (no "request completed" line ever appeared for that request, while every
  other concurrent request — including live autonomous heartbeat ticks with
  real model calls — completed normally) and Postgres (`pg_stat_activity`
  showed no stuck transaction or advisory lock; the request was blocked purely
  on an application-level `Promise` from `ApprovalBroker.create()`, which has
  **no timeout at all**). Resolving the pending approvals via
  `/core/approvals/resolve` let it complete immediately each time (draining 3
  sequential per-step approvals across the run). This is very likely **by
  design** for the Command Center's interactive approval UI (a human clicks
  approve whenever they get to it; there's no reason to force a timeout on a
  real person's attention), but it's a genuine trap for any non-interactive
  caller (a test script, or a naive integration) that doesn't also resolve
  approvals through a separate channel — worth a documented warning at minimum,
  and worth considering whether a bounded pending-approval TTL (auto-deny after
  N minutes, distinct from the interactive UI's own patience) would be safer
  for any future non-UI callers. Not fixed in this session (architecture
  question, not a one-line bug) — flagged for a future check-in.
- **Word-sense ambiguity, honest and harmless**: asked to "look back over what
  you know about my sleep and workshop habits," J.A.R.V.I.S. answered about its
  own **sleep-cycle** consolidation health (a real, valid finding — the
  embedding failures) rather than the user's personal **sleep schedule** facts
  on record. A legitimate model interpretation given real ambiguity in a vague
  prompt, not a system defect.

## Honesty notes
- Nothing was seeded: no heartbeat rows, no agenda items, no quiet-hours data
  were ever inserted directly. Autonomy was turned on via real settings (the
  same ones a user would flip in the Command Center); quiet hours were changed
  via the real settings API to test both branches, exactly as a user would; the
  announce/dissent tools were exercised through real conversational/agent
  requests, not database inserts.
- The two genuine issues found (the `ops.health()` bug, the approval-wait
  architecture trap) are reported honestly rather than smoothed over — the
  first is fixed and tested in this same session; the second is flagged as an
  open question for a future check-in rather than silently patched, since it
  touches the approval broker's fundamental interactive-wait design.

Key was env-only throughout (passed via process env at kernel start, never
written to a file) and confirmed scrubbed: 0 hits across the repo, the
scratchpad, and all background-task output files. Scratch DB (`jarvis_fresh`)
dropped after the run.
