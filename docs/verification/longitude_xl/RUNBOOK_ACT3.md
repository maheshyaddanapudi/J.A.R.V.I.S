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
