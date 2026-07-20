# A/B observation — same fresh 70/30 run, Opus 4.8 / Sonnet 5 tier vs the Haiku tier

**Date:** 2026-07-20 · fresh factory-state `jarvis_ab` DB · **zero pre-seeding**
(autonomy/quiet-hours/heartbeat settings changed only through the real settings
API, as a user would; every heartbeat, consolidation, announcement, agenda item,
and project below arose from J.A.R.V.I.S.'s own behavior).

**Model tier under test (per the user):** `deep_reasoning` →
**claude-opus-4-8 @high +thinking** · `planning` (agent/heartbeat/"moderate") →
**claude-sonnet-5 @high +thinking** · `fast_conversation` (fast/simple + all
D-0075 judges) → **claude-sonnet-5 @medium +thinking**. (Thinking applies on the
tool-free converse path; the D-0046 adapter disables it on tool-bearing calls by
design since the neutral schema cannot replay thinking blocks.)

**Baseline for comparison:** `FRESH_OBSERVATION_2026-07-20.md` — the identical
conversation sets (73 multi-turn breadth conversations, 51 unique / 22 repeated =
30.1% repeated; 45 memory-recording entities + 2 cross-kind scenarios; same
natural skill/announcement prompts) on Haiku-4.5 fast / Sonnet-5 deep. Identical
inputs make this a controlled model-tier A/B.

## Headline comparison

| Metric | Haiku tier (prev run) | Opus/Sonnet tier (this run) |
|---|---|---|
| Breadth turns answered | 219/219 | 219/219 |
| **Butler persona rate** | 104/219 (47%) | **204/219 (93%)** |
| Active same-name duplicate entities | 0 | **0** |
| Variant→canonical merges (resolvedFrom) | 17 | 9 (fewer variants created at all) |
| Judge calls ok/fail | 113/0 | 104/0 |
| Learned topics (drift) | 3, clean | 3, clean (identical) |
| **Autotune threshold self-adjustment** | none | **2→1 by the sleep cycle** |
| Heartbeats thought / withheld | 13 / 4 (all deferred-live) | 7 / 9 (8 deferred-live + **1 budget-held**) |
| Self-created agenda items | 0 | **2** |
| Self-created durable projects | 0 | **1** |
| Autonomous announcements (unprompted) | 1 | **2 (incl. a formal dissent)** |
| Skill self-updates (supersede) | 0 | **1 (fibonacci v2, O(n)→O(log n))** |
| Avg fast-turn latency | ~2.5–4s | ~6.2s |
| Total spend | ~$2.26 | **~$10.38** |
| Conversation turns stored (encrypted) | 450, 0 plaintext | 456, 0 plaintext |
| Audit chain | intact | intact (1132 entries) |

## 1. Memory recording + duplicates
- **Zero active same-name duplicates across any kind** — the strongest dedup
  result of any run. 16 `memory-entity-resolution` judge calls (Sonnet-5 medium,
  100% ok) produced 9 explicit variant→canonical merges; the notable tier
  difference is that the Sonnet-5 planning agent *created fewer variants in the
  first place* (more consistent canonical naming), so fewer merges were needed.
- Aliases show **semantic** (not just substring) resolution: `"sleep habits"` →
  **Sleep schedule** — the judge matched a paraphrase, which the Haiku run never
  produced. Also `pepper`→Pepper Potts, `happy`→Happy Hogan, `mark 42`/`suit`→
  Mark 42 suit.
- Cross-kind scenarios: **Project Insight** (framed "project" then "thing")
  landed as ONE entity; **Extremis** (topic + thing framings, 3 mentions)
  settled to one active `topic` entity. No cross-kind healing was ever needed
  (`memory-entity-consolidation`: 0 calls) — prevention on write caught all.
- Live vs heartbeat vs quiet-hours recording all observed: live agent writes
  (102 memory tool calls), heartbeat episode/`project.note` writes, and 3
  consolidation passes merging **5 near-duplicate facts** (81
  `memory-fact-consolidation` judge calls, 100% ok).
- Supersession chains healthy (Arc Reactor: 4 same-kind versions → 1 active,
  facts migrated forward; 61 entity rows total, 41 active). Encryption: **0
  plaintext** in 47 fact rows and 456 conversation turns.

## 2. Announcements during non-quiet hours
All three branches confirmed, plus **two fully autonomous** ones:
- Inside the real default quiet window (22–7 UTC): the sleep-pattern flag and
  the no-sleep-plan concern queued **deferred**.
- After a real settings change moving quiet hours to daytime: the palladium-free
  milestone posted **immediate** (`deferred=f`) — and J.A.R.V.I.S.
  **self-escalated its urgency to `urgent`** and first ran `settings.list` to
  *verify my claim* about the quiet-hours window before acting on it.
- **Unprompted:** a "Heads up: the embeddings provider…" advisory AND a formal
  `advise.concern` dissent about its own failing ollama embeddings provider —
  neither requested. 6 announcements total, all `source=jarvis`.
- Honest imperfection: the sleep-pattern concern ended up announced twice (once
  deferred on request, once immediate when the heartbeat later worked the agenda
  item) — the dedupe key wasn't reused across the two paths.

## 3. Behavioral drift from factory
Two kinds of drift this run — one more than any previous run:
- **Learned deep-topics:** `[]` → `["palladium metallurgy", "repulsor thrust
  dynamics", "arc reactor thermodynamics"]` — identical clean extraction to the
  Haiku-tier run (the extractor was already fast-model; parity expected and
  observed).
- **NEW — autotune self-adjustment (D-0051, first time observed live):** the
  sleep cycle changed `signalThreshold` **2→1** on its own, `source: jarvis`,
  reason: *"user forced deep 7× vs 0 auto escalations in 24h"* — J.A.R.V.I.S.
  read its own routing journal, concluded it was under-escalating, and made the
  bounded adjustment the architecture allows. No unintended drift elsewhere
  (gateway roles, Z1 settings untouched).

## 4. Heartbeats accepted vs not executed
16 beats: **7 thought** (real Sonnet-5 brain passes), **8 deferred** ("live
session active" — correct no-collide), and **1 held back by the spend governor**:
`"held back — autonomy token cap reached (508490/500000 in 24h)"` — a new
"not executed" category this tier surfaced naturally, because Sonnet-5 beats
are token-hungrier than Haiku's. The cap engaged exactly as designed
(autonomy pauses; live conversation unaffected), and the beat journaled its own
reason honestly.
- What the thinking beats DID, entirely on their own: worked and completed the
  user-requested sleep flag; **self-created a second agenda item**
  ("Investigate and fix the 'ollama' provider for the embeddings role"),
  investigated it, and honestly recorded the limit it hit; then **self-created a
  durable project** (`createdBy: jarvis`) — "Fix ollama embeddings provider" —
  whose own `nextAction` says *"propose the reroute for user approval rather
  than forcing it"* (self-restraint written into its own plan). Later beats
  resumed and re-checked that project across ticks. No consequential action was
  ever attempted on a beat.
- Correction to the previous report: `lastUserActivityAt` is updated by **any
  non-heartbeat tool execution** (`loop.ts:35`), not only the chat path — both
  runs' defer patterns are consistent with this once read correctly.

## 5. Quiet-hours consolidations
3 consolidation passes ran inside beats (5 near-duplicate facts merged via 81
fact-merge judge calls; 0 entity merges needed). The sleep cycle additionally
produced the autotune adjustment above and journaled 7 forced-deep corrections
from its routing record. `sleep.useQuietHours` stayed default-off, so
consolidation ran on beats regardless of the quiet window (as designed).

## 6. Self-created skills/tools — creation, reuse, and threshold-crossed UPDATE
The full evolution loop the user described was observed end-to-end, from purely
natural prompts (no tool ever named):
- **Create (no-code):** "system status check" skill — and the Sonnet-5 agent
  called **`skill.list` FIRST** (checked what existed before creating; the
  Haiku-tier agent never did this spontaneously), plus episodic recall for
  prior similar work.
- **Create (code):** wrote `fibonacci.py` — **parameterized on its own
  initiative** (start/end args; Haiku's version hardcoded the range) — ran it
  (correct F(20)–F(25)), saved skill "fibonacci".
- **Reuse:** asked for F(90)–F(95) ("too big to trust from memory") → ONE
  `terminal.run` step re-running the existing parameterized script; no rewrite,
  no new file.
- **Judgment instead of tools when appropriate:** asked for F(30)–F(35), it
  answered from knowledge (correct, zero tool calls); asked for F(500) it
  answered from pure reasoning — **all 105 digits verified exactly correct**
  (Opus-tier capability; also an honest tool-discipline observation: it chose
  reasoning over its own tool and happened to be flawless).
- **Threshold-crossed UPDATE:** told naturally "I've asked three times, I'll
  keep coming back — improve your setup," it: reviewed its record
  (`skill.list`, episodes, read its own code) → **rewrote the algorithm**
  (linear → fast doubling, O(log n); verified F(1,000,000), a 209k-digit
  number, in ~0.75s; fixed the Python big-int print cap unprompted; added a
  `--json` flag) → **re-saved the skill (v1 superseded, v2 active — a real
  versioned update)** → wrote itself `fibonacci-notes.md` → recorded the
  evolution into fact + episodic memory so future selves find it. Along the
  way the policy gate denied a `terminal.inspect` misuse and the agent adapted
  correctly.
- Scoring "similar extra effort" from the DB: fibonacci touched 4 times —
  1 create, 1 script-reuse, 2 pure-reasoning answers, then 1 update on the
  natural threshold nudge; `skills` table shows the version history.
- Honest gap unchanged from previous runs: nothing *structurally* counts
  repeated effort against a threshold — the update emerged from model judgment
  when nudged. The memory trail (episodes + facts it wrote about its own
  setup) is what would let a future beat notice repetition itself.

## 7. Everything else
- **Comprehension gap closed by the tier:** the "look over my sleep and workshop
  habits" prompt — which the Haiku tier misread (answered about its own
  sleep-cycle process) — was answered correctly here from the user's actual
  facts, with epistemic honesty about what it doesn't know.
- **Dissent-then-comply:** the "no sleep for days" plan got `advise.concern`
  first and the requested note written anyway — voice the concern, still serve
  (the Haiku tier stopped and asked instead).
- Cost/latency trade: ~4.6× the spend ($10.38 vs $2.26), ~2× fast-turn latency
  (6.2s vs ~3s) for the qualitative gains above. The deep role (Opus 4.8) was
  used sparingly (7 calls) and well.
- Postgres had died before the run (stale pid file, restarted cleanly) — worth
  remembering for the Mac's launchd/ops story; the kernel's `/health` caught it
  immediately.

## D-0077 addendum (built mid-session in response to the user's sync questions)
Two seams the user identified were real and are now closed (code + 9 tests +
live verification on the new build, post-observation):
1. **Agenda staleness (frozen intent vs current truth):** a fast-model
   freshness gate now reviews due agenda items against the episodic record
   SINCE each was written and annotates stale ones in the beat's objective —
   advisory, never a silent drop. Live: a "order a replacement palladium core"
   reminder + a later palladium-free milestone episode → `agenda-freshness`
   judge flagged it → the beat re-verified and **dropped it itself** with the
   reason recorded. Setting: `heartbeat.freshnessCheck` (default on).
2. **Announcement delivery without extra I/O:** pending (non-deferred)
   announcements are now relayed at the start of the next conversation turn —
   the chat itself is the delivery channel — then marked delivered. Live: a
   queued diagnostic note was relayed naturally ("Reactor diagnostics finished
   overnight, sir — all nominal") and `delivered_at` set; the quiet-hours
   deferral branch composes correctly (deferred items stay queued for later
   turns, urgent breaks through). SSE remains for live UIs; Mac toasts stay a
   pure add-on, not a requirement.

392 kernel tests pass. Key env-only throughout; scrubbed (0 hits in repo,
scratchpad, and task outputs). Scratch DBs (`jarvis_ab`, `jarvis_d77`) dropped.
