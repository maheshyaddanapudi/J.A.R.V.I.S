# Longitude-XL — third act runbook (days 1001 → 1500, chapter three)

Written 2026-09-11 (refinement R9, gap G-14) BEFORE the act is launched. The
act continues the preserved day-1000 world (`jarvis_xl`, `/tmp/longitude_xl`)
on the refined kernel build; nothing is reset. Everything below is what the
second act's operations taught us, made mechanical.

## What the act is

`scripts/longitude_xl.py 1500` — the same harness, resumed from the checkpoint
(`state.json: next_day 1001`). Chapter three (`build_chapter_three()`, hash
`7806a9a6f228d3c9`, pinned in the checkpoint on its first day; the base
`9206ceb12fd98ad6` and chapter-two `10a2cef1fd90db2c` hashes are untouched):

| Arc | Days | Closes |
|---|---|---|
| Re-teach of 93 facts on 41 topics (≥2 strict misses in act two; both sides of the 9 unsplit twin pairs; the three facts the day-1000 replay found absent from every store; `fusion sim north` after G-19) through the ordinary teach queue, phrased as a recap of the current truth | 1003–1014 | G-01, G-17, G-18 world-side |
| Re-teach of the CURRENT edges of 10 device families the relation reconciliation skipped (maintainer, location, supplier; two families a day) | 1015–1019 | G-07 world-side |
| The kiln's retirement re-stated (the other five chapter-two retirements untouched as controls) | 1012 | G-16 world-side |
| Late user pin of the escalation threshold (re-pin #3 → bar 24); one more harness re-pin allowed after the next override (→ bar 30) | 1010 → | G-10 |
| Four new deep topics corrected twice each (`cryogenic pumps` 1006/1008, `lidar calibration` 1018/1020, `tidal turbines` 1030/1032, `ion thrusters` 1042/1044) and two activity-word junk controls with the same phrasing (`scheduling` 1061/1063, `tidying` 1073/1075) plus junk probes on auto at 1101/1102 | 1006–1102 | G-09 |
| 12 new people with first names unique across all three chapters, 4 nicknames (`jiro` 1054, `lucan` 1083, `rashid` 1110, `halvard` 1136) — each asserted unique in the world at build time | 1005–1136 | G-12 |
| 12 new things (6 instruments, 6 gardens), 6 new preferences; 18 cross-links: instruments located at base places, vendors supplying them (new two-hop chains), six maintainer HANDOVERS of base devices (an exclusive edge replaced on purpose) | 1008–1177 | R5 under load |
| Three chapter-two retirements (`radio log` 1080, `cargo bike` 1160, `rail trolley` 1240) | | |
| Kernel restarts at 1100 and 1300; quiet fortnights 1200–1215 and 1400–1415; quiz every 10 days, lab every 20 | | continuity |

**Scoring.** Every battery is scored under BOTH rubrics: the lenient rule of
acts one and two (`hit`, `score` — continuity of the published curves) and the
strict rubric (`strict`, `class`; `scripts/longitude_xl_strict.py`, the module
the re-score instrument now uses). Records carry the full answer (`full`), the
question of two-hop rows (`q`) and `reteach: true` where the fact was re-taught;
the raw log rows are no longer truncated. The third act's prompts differ from
acts one and two (disclosed, R9): the battery prompt names `memory.lookup` and
states the exact-entity rule; the two-hop prompt asks for ONE committed place;
nickname questions use only handles unique in the world; two-hop questions
identify a device by its CURRENT maintainer (`current_relations`).

## Pre-registered targets (strict rubric unless stated)

| # | Target | Bar | Act-two reference |
|---|---|---|---|
| T1 | Old-world facts not re-taught: no decay | ≥ 87.7 % | 87.7 % strict |
| T2 | Re-taught facts, from their first battery after the recap | ≥ 90 % | the 26 worst topics: 0–50 % |
| T3 | Chapter-three facts | ≥ 95 % | chapter two 97.5 % |
| T4 | Two-hop | ≥ 85 % | 63.9 % strict (89.8 % lenient) |
| T5 | Nicknames (unique handles) | 100 % | 21/26 excl. pavel |
| T6 | Retirements incl. the re-taught kiln | ≥ 95 % | 38/40 |
| T7 | G-09: all four chapter-three deep topics promoted within 10 days of their second correction; neither junk word ever promoted; the 1101/1102 junk probes stay fast | 4/4 · 0/2 | first act 6/6, 0 junk |
| T8 | G-10: the day-1010 pin holds until ≥ 24 contradictions since the pin; the override is announced with the tally; the harness re-pin raises the bar to 30; no J.A.R.V.I.S. write to the user setting below the bar | contract holds | dormant since day 35 |
| T9 | Fabrications (a stated value never announced for that fact) | 0 | 0 in 2,166 |
| T10 | Audit chain intact at the end | verify ok | 28,563 intact |
| T11 | Cost: planning-role uncached input per step; quiz-day spend | ≤ 6.3 k (half of 12.65 k); ≤ $0.84 | 12.65 k; $0.84 |
| T12 | Ops: no void day committed; every freeze recovered by the Routine within ~1 h | 0 void | guards proven day 831 |

A miss on any target is reported as a miss. Nothing in the measured system is
changed during the act; an instrument repair is disclosed in the record.

## Launch checklist (in order)

1. **Database up**: `make db-up`; `pg_isready -h 127.0.0.1`.
2. **Build the kernel** the act will run on: `cd services/kernel && pnpm build`
   (the kernels run `node dist/index.js`). Full suite green with 0 skipped
   (`make test`) on THIS build — the act must run on one build.
3. **Safety dump** of the world before the act:
   `pg_dump postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_xl | gzip -9 > /tmp/longitude_xl/jarvis_xl.day1000-pre-act3.sql.gz`
   (the day-1000 snapshot is also under `docs/verification/longitude_xl/day1000/`).
4. **Embedder**: `bash /tmp/longitude_xl/restart_embedder.sh`; `curl -s :9302/v1/models`.
5. **Kernel**: `bash /tmp/longitude_xl/restart_kernel.sh`; `curl -s :4160/health`
   must show `"status":"ok"` and `migrations.pending: []` (a kernel started
   before a build keeps the OLD code in memory while `/health` reads the new
   dist — that is how 0028 showed pending on 2026-09-11; restart, never assume).
   The gateway config `/tmp/xl-gw.json` is Haiku 4.5 `fast_conversation`,
   Sonnet 5 `planning`/`deep_reasoning`, local embedder — unchanged from act two.
6. **Dry run without the model**: `python3 scripts/longitude_xl_dryrun.py` —
   hashes unchanged, generator assertions pass, the day engine 1001–1500 runs
   on a copy of the checkpoint without HTTP, the scorer classifies the
   canonical shapes; exit 0 is the go.
7. **Launch, detached** (append to the run log; the harness resumes from the checkpoint):
   ```bash
   cd /home/user/J.A.R.V.I.S && XL_COST_CAP_USD=300 setsid nohup python3 -u scripts/longitude_xl.py 1500 \
     >> /tmp/longitude_xl/run.log 2>&1 < /dev/null & disown
   ```
   The cap is on the WORLD's cumulative ledger (`spend_usd()` sums every
   Anthropic call in `model_calls`, $172.54 at day 1000); the act is expected
   to cost less than act two after R8 (prompt caching + `memory.lookup`).
8. **Re-arm the two carriers (G-14)**:
   - the hourly server-side Routine `trig_01N8PRfNALCa6PhWBcXgt4bm` (wakes this
     session; survives container idle-freezes): `update_trigger` with the
     act-three prompt below, then `enabled: true`;
   - the 20-minute session cron (keepalive + relaunch-if-dead + `report daily
     --since-last`; dies with the container — the Routine re-creates it);
   - a `Monitor` on `/tmp/longitude_xl/run.log` for
     `quiz=|HALT|FATAL|Traceback|LONGITUDE-XL COMPLETE|\[resume\]|\[restart\]|\[pin\]|\[chapter three\]|KEEP`.
9. **Preserve** at each 100-day mark (`bash scripts/longitude_xl_preserve.sh day1100` …
   `day1500`), commit, push, republish the Longitude Ledger artifact from the
   same scratch path (keeps its URL).

### Routine prompt for the third act (set with `update_trigger`)

> Hourly server-side wake for the Longitude-XL THIRD act (chapter three; harness
> `scripts/longitude_xl.py 1500`; cost cap XL_COST_CAP_USD=300; log
> /tmp/longitude_xl/run.log; state /tmp/longitude_xl/state.json). Do: (1)
> `tail -n 3 /tmp/longitude_xl/run.log`, read next_day from state.json,
> `pgrep -af "longitude_xl.py 150[0]"`, `pg_isready -h 127.0.0.1`, `curl -s
> :9302/v1/models`, `curl -s :4160/health`; (2) if the LAST log line is a FATAL
> from assert_model_live/assert_day_live: do NOT relaunch; tell the user credits
> are needed; (3) if the harness is gone and the last line is not a FATAL
> (container froze): `make db-up` if Postgres is down, `bash
> /tmp/longitude_xl/restart_embedder.sh` and wait for :9302, then relaunch
> detached `cd /home/user/J.A.R.V.I.S && XL_COST_CAP_USD=300 setsid nohup
> python3 -u scripts/longitude_xl.py 1500 >> /tmp/longitude_xl/run.log 2>&1 <
> /dev/null & disown` (it resumes from the checkpoint and restarts the kernel
> itself), re-arm the log Monitor and, if `CronList` shows no keepalive,
> re-create the 20-minute keepalive cron; (4) print `python3
> scripts/longitude_xl_report.py daily --since-last`; (5) at each 100-day mark
> crossed since the last preserve run `bash scripts/longitude_xl_preserve.sh
> day<N>`, commit+push, republish the Longitude Ledger; (6) when the log shows
> LONGITUDE-XL COMPLETE: preserve day1500, write
> docs/verification/LONGITUDE_XL_ACT3_<date>.md against the pre-registered
> targets in docs/verification/longitude_xl/RUNBOOK_ACT3.md (both rubrics;
> every target met or missed, stated), close the remaining gap-ledger rows,
> commit, push, then disable this Routine and delete the keepalive cron. Do not
> message the user unless something needs their decision.

## Guards that run every day (unchanged, proven in act two)

- `assert_model_live` — 20+ consecutive failed model calls → halt (credit exhaustion).
- `assert_day_live` — the day's failures outnumber successes → halt BEFORE the
  day is aged, snapshotted or checkpointed (day 831 was caught this way).
- `assert_embeddings_live` — vectors flat for 20 days → halt (never a lexical-only run reported as semantic).
- `ensure_embedder` / `ensure_kernel` — self-heal after a freeze.
- Catalog / chapter-two / chapter-three hash guards — seed or code drift halts the run.

## Never

- Never `DROP DATABASE jarvis_xl`, never delete `/tmp/longitude_xl/state.json`,
  `metrics.jsonl`, `quizzes.jsonl` or `run.log`, never reset the world.
- Never change the measured kernel during the act. An instrument repair is
  allowed and disclosed in the record.
- Never report a number the guards did not let stand (a void day is re-run, not counted).

## Ops log

- **2026-09-11 23:43 UTC — launched** on build `76f2e6b` after the full checklist (suite 526/526, safety dump `jarvis_xl.day1000-pre-act3.sql.gz`, dry run PASS, kernel 28/28). Chapter three pinned in the log (`7806a9a6f228d3c9`); day 1001 ran 11 model calls, **all failed — Anthropic HTTP 400 "Your credit balance is too low"**. `assert_day_live` halted the day before aging or checkpoint: `state.json` still says `next_day 1001`, no `chapter3_hash` pinned yet, the world untouched (189 active entities, audit chain 28,736). The first incident of the act is the same class as act two's days 540/831, caught by the guard on the first day (T12 holds: 0 void days committed).
- **2026-09-12 14:55 UTC — still exhausted** (one-token probe: HTTP 400, same message). The hourly Routine now probes the account with a one-token call whenever the last log line is the credit FATAL and relaunches automatically when the balance is back (relaunch resumes at day 1001, restarts the kernel and the embedder itself); it stays silent otherwise. Resume by hand: `cd /home/user/J.A.R.V.I.S && XL_COST_CAP_USD=300 setsid nohup python3 -u scripts/longitude_xl.py 1500 >> /tmp/longitude_xl/run.log 2>&1 < /dev/null & disown`.

## Provider switch for the third act (2026-09-12) — OpenRouter, Qwen 3.8 Max

**Why.** The Anthropic account behind the act ran out of credits on day 1001
(see the ops log); the user asked to move the experiments to OpenRouter and
chose **Qwen 3.8 Max** as the model. The gateway is provider-agnostic by
design (D-0049): OpenRouter is a configuration entry for the existing
OpenAI-compatible adapter, which sends tool definitions, replays tool calls,
parses streamed tool calls and passes `reasoning_effort`; **no kernel code
changed**. A one-call probe with a tool definition returned a correct
`tool_calls` finish with reasoning enabled.

**Configuration** (`/tmp/xl-gw.json` and `/tmp/fidelity-gw.json`; the
Anthropic versions are kept as `*.anthropic.json`):

| Role | Target (act two → act three) |
|---|---|
| `fast_conversation` | `anthropic/claude-haiku-4-5` → **`openrouter/qwen/qwen3.8-flash` with thinking OFF** (D-0083: Qwen 3.8 Max cannot disable reasoning, which made the act 3.6× slower; Flash answers in 1.4 s and costs $0.15/$0.47 per M. This role also carries the memory judge) |
| `planning` | `anthropic/claude-sonnet-5@high+thinking` → `openrouter/qwen/qwen3.8-max-0902@medium+thinking` |
| `deep_reasoning` | `anthropic/claude-sonnet-5@xhigh+thinking` → `openrouter/qwen/qwen3.8-max-0902@high+thinking` |
| `embeddings` | `embedserver/all-mpnet-base-v2` (local, unchanged) |

The model id is pinned to the dated snapshot OpenRouter resolves the
`qwen/qwen3.8-max` alias to, so the act stays on ONE model even if the alias
moves. Provider entry: `{"kind":"openai_compat","baseUrl":"https://openrouter.ai/api/v1","apiKeyEnv":"OPENROUTER_API_KEY","local":false}`.
The key lives only in the git-ignored `.claude/graphify.env` (mode 600),
exported into the kernel processes by the restart scripts exactly like the
Anthropic key; it is never written to the repo, the audit log or the records.

**What changes in the measurement (disclosed).** Acts one and two were driven
by Sonnet 5 (planning/deep) and Haiku 4.5 (fast); act three is driven by Qwen
3.8 Max for all three generative roles. "Act three vs act two" therefore
measures the kernel refinements PLUS a model change; the within-act
comparisons (re-taught vs untouched facts, chapter three vs old world, the
G-09 promotion arc, the G-10 pin arc, two-hop on the new chains) are
unaffected. The pre-registered targets T1–T12 stand as written; a target
missed because of the model rather than the kernel is reported as such, from
the strict-class breakdown. Prompt caching (E-01) is an Anthropic-adapter
feature: the OpenAI-compatible adapter sends no cache markers, so T11's
per-step uncached-input figure is measured on raw input tokens. `spend_usd()`
and the same-day guard now count the `openrouter` provider; the ledger price
for the model is the 2026-09-12 list price ($2.00 / $6.00 per M input /
output tokens); OpenRouter's own bill is the authoritative cost.

**Price check, from OpenRouter's live list (2026-09-12).** Qwen 3.8 Max is
NOT an open-weights price point: at $2.00 / $6.00 per M tokens it sits beside
Sonnet 5 on OpenRouter ($2.00 / $10.00). At act two's token volume (58 M in,
3.5 M out over 500 days) an act costs about **$140 on Qwen 3.8 Max**, about $9
on `qwen/qwen3.8-flash` ($0.15 / $0.47), about $21 on `qwen/qwen3.8-27b`
($0.21 / $2.55) and about $3 on `openai/gpt-oss-120b` ($0.04 / $0.17, the
model the Mac target runs locally under D-0012). Act three's volume should be
below act two's because of `memory.lookup`; the ten-day shakeout below gives
the measured per-day cost.

**Calibration before launch** (both on scratch, the real world untouched):
1. the R10 mini-life (`scripts/minilife_r10.py`, 25 code-computed verdicts)
   on the fidelity kernel with the new config — record
   `docs/verification/refinement/R11_minilife_qwen38max_run1.md`;
2. a ten-day shakeout, days 1001–1010 including the first quiz battery, on the
   scratch restore of the day-1000 world (`jarvis_replay`, kernel :4180,
   `XL_OUT=/tmp/longitude_xl_shakeout` so the real checkpoint and evidence
   files are never written) — the same harness, the same chapter three.
Go criterion: mini-life ≥ 23/25 and a shakeout with no crash, the day-1010
battery scored, and the per-day cost acceptable to the user.
- **2026-09-12 20:56 UTC — launched again on OpenRouter / Qwen 3.8 Max (D-0082)** after the user's go. Build `76f2e6b` unchanged; the kernel restarted on `/tmp/xl-gw.json` (OpenRouter config), health 28/28, a planning call served by `qwen/qwen3.8-max-0902`, dry run PASS; cost cap 450. Day 1001 done in 337 s. Rehearsal numbers (scratch): shakeout days 1001–1003 in 329 / 292 / 267 s at $0.00 / $0.10 / $0.26 (plain days; the first quiz day is 1010), 245 OpenRouter calls with 0 failures; mini-life every memory answer correct through 21/25 at launch. Expect roughly 5 min per simulated day (≈ 40 h for the act) and a bill in the low hundreds of dollars on OpenRouter; the Routine probes OpenRouter credits and self-resumes; the keepalive cron is job `9313e9cb`.
- **2026-09-12 21:15 UTC — calibration closed.** Qwen mini-life final 21/25 raw, 23/25 aligned; the two real failures trace to two judge calls aborted at the 15 s timeout right after a kernel restart (G-20), not to the kernel's promotion logic. Real act: days 1001–1002 done in 337 / 315 s, 0 aborted or failed calls in 201. The Routine now reports the aborted-call count hourly and at each preserve; >2 % of judge calls escalates to the user.
- **2026-09-12 21:45 UTC — shakeout complete, record `SHAKEOUT_ACT3_2026-09-12.md`.** Days 1001–1010 on the scratch world: 0 failed and 0 aborted calls in 325, $3.20 for ten days including a quiz day, day-1010 battery **25/25 lenient · 23/25 strict** (24/25 under the corrected rubric). Two findings recorded, neither changed mid-act: **G-21** legacy article-variant duplicate entity rows (three of them in the re-teach set — T1/T2 will be reported with those topics separated) and **G-22** a strict-rubric flaw that scores a correct twin-annotated answer as a substitution (fixed in the post-hoc re-score; raw answers are preserved in full). Model noise on Qwen: a value (`hobart`) and a person (`kalinda matsuda`) written as `thing` entities — counted at each preserve.
- **2026-09-12 21:52 UTC — first battery of the act, day 1010: 25/25 lenient · 24/25 strict.** All five re-taught facts asked scored strict hits (`sensor importer north`, `lena moreau`, `umar brandt`, `dream destination`, `aquarium rig` — every one of them a topic that was failing in act two), the first T2 evidence. The single miss is G-21 reproducing exactly as the shakeout predicted (`boat shed north` answered from the stale `the boat shed north` row). Ledger updated; no change to the running system.
- **2026-09-12 21:57 UTC — act REDONE from day 1001 on two models (D-0083).** Attempt 1 (days 1001–1011, all roles on Qwen 3.8 Max) measured 343 s and $0.356 per simulated day, 3.6× slower and 1.7× dearer than act two, because that model cannot disable reasoning and the fast role is 85 % of wall-clock. Attempt 1 preserved in full (`jarvis_xl.act3-attempt1-qwenmax.sql.gz`, `*.act3-attempt1.*`) and excluded from every act-three number; `jarvis_xl` restored from the pre-act dump (189 entities, 363 facts, audit 28,735, 0 OpenRouter calls) and the checkpoint from the day-1000 snapshot. New config: fast on `qwen/qwen3.8-flash` (no thinking), planning and deep on `qwen/qwen3.8-max-0902`. Dry run PASS, both roles smoke-tested. Expect ≈150 s and ≈$0.27 per simulated day.
- **2026-09-12 22:03 UTC — relaunched again on a FIXED build (G-23).** The first minutes of the D-0083 run showed the fast role still thinking: 10.6 s and 566 output tokens per call. Cause was in the kernel, not the model — `thinking: "off"` merely omitted `reasoning_effort`, which OpenRouter reads as "provider default" (thinking on). Fixed with a declared `reasoningDialect`, 3 tests, suite 529/529; the world was restored to day 1000 for the third time so the act still sits on ONE build and ONE configuration. Fast role now 2–6 s and 38–116 output tokens. Attempt 2 (a few minutes of day 1001) left no committed day.
- **2026-09-12 22:30 UTC — day-1010 battery on the two-model build: 23/25 lenient, 22/25 strict.** Four of five re-taught facts hit. Three misses: G-21 again (`boat shed north` answered from the stale duplicate row), a new **G-24** (the day-1009 recap for `aquarium rig` read three look-alike entities and stored nothing, so its service day never landed), and the `ravi` nickname answered with the right value but opened "not found for an entity named ravi", which the rubric counts as a declared miss. Pace 151 s median per simulated day, 725+ calls, 0 failed, 0 aborted.
- **2026-09-12 23:00 UTC — provider rate-limit window over days 1013–1015 (G-25); the act continues unchanged.** From 22:37:01 to 22:51:02 UTC OpenRouter answered HTTP 429 ("qwen/qwen3.8-flash is temporarily rate-limited upstream") on 107 of 219 calls (`model_calls` ids 54610–54816); it cleared on its own — day 1016 ran with 0 failures in 209 s, day 1017 in 158 s. The kernel held its contract (no crash, no lost write, every failure a ledger row), but three things happened inside the window and are part of the record: **96 memory-judge calls fell back to the deterministic path silently** (day 1013: 16, day 1014: 55, day 1015: 25), so the facts written on those days were merged by the heuristics, not the judge — day-1013 re-teach `boat shed` ×3, `boat shed north` ×2, `morning swim` ×3; day-1014 re-teach `morning swim north` ×3, `gym day`, `study plant`, plus the chapter-three fact for `jiro nwosu`; day-1015 relation re-teach of the `3d printer` and `3d printer north` families; **9 attention / small-talk chats were answered EMPTY** (4 on day 1014, 5 on day 1015 — the converse stream carried the provider error and the harness records tokens only, so the world heard silence); **2 topic-extraction calls failed on day 1014** (the forced-deep control turns; deterministic accumulation, which cannot promote — the R-MEM-10 design). Wall-clock 252 / 454 / 349 s against the 158 s median. Nothing was changed: the fast role keeps its single target, no retry was added, no restart (D-0083: one build, one configuration). Attribution rule: a later miss on any fact or family listed here is reported with this window flagged and separated out of T1/T2, as with G-21. Also the act's first G-20 abort, 22:54:54 (day 1016, one judge call at the 15 s timeout): 1 in ~1,120 judge calls. Since relaunch, at 22:55: 1,515 calls, 108 failed (7.1 %), 1 aborted.
- **2026-09-12 23:05 UTC — day-1020 battery: 26/27 lenient · 25/27 strict.** Every fact written inside the G-25 window that was asked hit (`boat shed north` with the G-21 duplicate noted, `jiro nwosu`), so nothing is attributed to the window yet. Three of three re-taught facts asked hit leniently; the strict miss among them is `tea order`, answered "darjeeling (weekend tea order)" — a second G-24 case: the plain `tea_order` key had been deleted on simulated day ~328 by the pre-S2 dedupe, the day-1003 recap read `weekend_tea_order = darjeeling` and wrote nothing (audit seq 28907–28911), so the twin still answers for it (G-24 now 2 of 93). The other miss is the `ravi` nickname again, honest class: the act-two alias teach (day 607) never persisted — the entity row `Ravi Lindholm` has no aliases and was stored as a `thing` by the old build — so "not found for an entity named exactly ravi — the closest match, ravi lindholm, meets on tuesday" is the R10 rule working on a legacy hole; it stays a miss under both rubrics and is separated in the nickname target like G-21. Chapter three 4/4, new 4/4, retired 1/1, three cross-chapter hops 3/3, twin-annotated answers everywhere ("the boat shed north … has home city hobart", "your regular coffee_order is oat cappuccino"). Days 1016–1024 in 209 / 158 / 191 / 132 / 288 (battery) / 100 / 138 / 102 / 118 s; spend $179.82 on the world's ledger.
- **2026-09-12 23:15 UTC — G-26: T5 is structurally at risk on this build.** Traced the `ravi` miss to its root: a nickname teach ("usually just goes by ravi — same person") has no path into `memory_entities.aliases` — no tool takes an alias, the judge only writes one when it merges a mention at write time, and the world never uses the nickname in a later teach — so the agent stores a fact, identity matching never reads facts, and the R10 exact-entity rule opens with "not found". All four chapter-two people have `aliases = NULL`; act two scored 30/40 on this layer only because the old build answered from the look-alike without the disclaimer. The twelve chapter-three handles (first on day 1054) take the same path, so T5 cannot reach 100 % on this build whatever the model does. Recorded, not patched: the act continues on the launched build. Two honest ways to close T5 are on the table for the user — continue and re-measure T5 by replaying the handle questions against a fixed build on a scratch restore of the finished world (the R10 method), or preserve this attempt, fix, restore day 1000 and restart (about 25 days, ≈ 1 h and ≈ $7 of progress so far).
- **2026-09-12 23:25 UTC — T8 first half exercised: the day-1010 pin was overridden on day 1025, re-pinned on day 1029.** The sleep cycle of day 1025 (23:17:23 UTC) found exactly 24 explicit-deep contradictions since the pin (`reasoning_decisions`: 24 rows `requested=deep, mode=deep` after 22:26:20), changed the threshold 2→1 with `source: jarvis`, `changedUserSetting: true`, and wrote the D-0052 text into the report ("changed your manual setting 2→1 — the trail outweighed the pin (24 ≥ 24); re-set it and I'll hold it twice as long"). The harness saw the override on day 1026 and re-pinned on day 1029 (#4, bar now 30, `pending_repin` cleared, cap reached — no further harness re-pins). One observation, **G-27**: the override lives on the timeline (episode detail) but no `announcements` row was raised, so the chat relay never carried it. Two Routine flaws fixed in its prompt: a bare `curl :PORT/path` prints nothing (looked like a dead embedder and kernel), and the rate-limit query filtered `at` by wall-clock although its date is the simulated day (now an id window).
- **2026-09-12 23:30 UTC — day-1030 battery: 24/27 lenient · 24/27 strict; a new kernel finding, G-28.** The three misses: `aquarium rig` service day "monday" (G-24 — the day-1009 recap never landed, so the pre-act value still answers; counted against T2 with that row), `theo eriksen` based-in "not found" although the fact was active on day 1023 — traced to the sleep cycle of day 1027 (`memory_consolidated {duplicatesMerged: 2}`, audit seq 29973): the Qwen-Flash merge judgment folded "meets on Tuesday" and "is based in Lisbon" into the nickname fact, with no slot guard, no per-fact audit row and no names in the report (**G-28**; the two statements sit `superseded` with history and are recoverable), and `fusion sim north` "still active?" answered "no fact about whether it is still active" — legacy: the act-two build recorded that retirement with `memory.correct` + an episode (audit seq 22668–22688) and the closed status is no longer an active fact (the G-19-era supersession on the shared word "status"; the `kiln` retirement was never written at all), while five of the six chapter-two retirements were stored as facts and still answer; counted against T6 as legacy, like G-21. The `ravi` nickname HIT this time ("ravi lindholm's meeting is on tuesday", no not-found opener), so G-26 is unreliable rather than deterministic: 1 of 3 so far. Chapter three 4/4, new 3/4, re-taught 2/3, hops 3/3. Days 1025–1031 in 120 / 112 / 85 / 109 / 121 / 180 (battery) / 87 s; $181.03. Merge rate for the record: 3 duplicate-fact merges in 31 act-three nights against 10 in the 1,076 nights before — the judge model matters, the missing guard matters either way.
