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
