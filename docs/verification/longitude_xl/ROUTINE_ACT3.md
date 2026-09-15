# Act-three hourly Routine — operating instructions

The server-side Routine "Longitude-XL hourly wake (third act)"
(`trig_01N8PRfNALCa6PhWBcXgt4bm`, cron `7 * * * *`) fires a short prompt that
points here. Keeping the detail in the repo instead of the trigger prompt means
each wake costs ~100 tokens of session context instead of ~4,000 — 17 queued
wakes during the credit halt of 2026-09-13 cost more context than the work they
guarded (found and fixed the same day).

**The Routine exists because the container idle-freezes** and session-local
crons die with it. It is the only thing that can resume the act unattended.

## The act it guards

**Longitude-XL FOURTH act, chapter four, days 1501→2000** (2026-09-15 →),
harness `scripts/longitude_xl.py 2000`. Chapter four is pinned at day 1501 with
hash `81e29522d604d863` and its own drift guard: any edit to the layer halts the
run rather than quietly changing what is measured. Record + pre-registered
targets T4′/T5′/T6′: `RUNBOOK_ACT4.md`. Preserves at 1600/1700/1800/1900/2000.

Provider OpenRouter, unchanged from act three's second half so this act has NO
model seam: `fast_conversation` + the D-0075 memory judge on
`inclusionai/ling-3.0-flash` with `qwen/qwen3.8-flash` as the chain fallback,
`planning` and `deep_reasoning` on `qwen/qwen3.8-max-0902`. Gateway config
`/tmp/xl-gw.json`; key `OPENROUTER_API_KEY` in the git-ignored
`.claude/graphify.env` (never print it). Cost cap `XL_COST_CAP_USD=450` on the
world's cumulative ledger. Log `/tmp/longitude_xl/run.log`; checkpoint
`/tmp/longitude_xl/state.json`.

**This container freezes often** — twice within an hour on 2026-09-15. A freeze
costs NOTHING (the checkpoint holds, the harness restarts the kernel itself, no
day is lost) but the run stalls until something relaunches it. **Relaunching a
frozen run is the single most valuable thing this Routine does**; do it on every
wake where the harness is gone and the last log line is neither FATAL nor HALT.

**Budget is the one thing this Routine cannot fix.** Balance was ~$16.90 at day
1535 against a projection near $10–15 for the remaining days. If the run halts on
credits (OpenRouter 402), do NOT relaunch below $1 — tell the user once, with the
balance and the day reached, and wait.

The act-three history below still applies as procedure; where it says day 1500 or
chapter three, read the fourth act's horizon and layer.

## A pause is not a freeze

**Before anything else, check `/tmp/longitude_xl/PAUSED`.** If that file exists,
the harness is down because a human decision is outstanding, not because the
container froze. Print its contents, relaunch NOTHING, and say nothing further
to the user — they already hold the question. Only a person clears the file (or
Claude does, on their explicit answer). Automated carriers that relaunch a
deliberately paused act destroy exactly the evidence the pause was protecting.

Introduced 2026-09-13, when the 20-minute keepalive fired 3 minutes into a pause
taken to stop an OpenRouter rate-limit window from writing more confounded days,
and its own rule ("harness gone + no FATAL/HALT ⇒ relaunch") would have resumed
the run over an unanswered question.

## Every wake, in order

1. **Look.** `tail -n 3 /tmp/longitude_xl/run.log`; `next_day` from
   `state.json`; `pgrep -af "longitude_xl.py 150[0]"` (bracket trick — never put
   the plain pattern on the same command line as `pkill`); `pg_isready -h
   127.0.0.1`; `curl -s -m 5 http://127.0.0.1:9302/v1/models`; `curl -s -m 5
   http://127.0.0.1:4160/health`. Always the full `http://127.0.0.1:PORT` form —
   a bare `:PORT/path` makes curl print nothing and looks like a dead service.
2. **Harness running?** Print one line (day, last wall-clock) and go to step 4.
3. **Harness gone.** Read the last log line:
   - **FATAL on credits/billing** (OpenRouter 402, "insufficient credits"):
     read the balance FIRST —
     `curl -s -m 30 https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $OPENROUTER_API_KEY"`
     — and print only `total_credits`, `total_usage` and the difference. A
     simulated day costs ≈ $0.30 and the remaining days ≈ $135, so **relaunch
     only when the remaining balance is ≥ $1** (and a one-token probe returns
     200). Below $1, do NOT relaunch — it would burn the last cents into another
     void day — and stay SILENT: the user was told once at 01:20 UTC on
     2026-09-13 and does not need it repeated.
   - **FATAL, other** (key invalid, embedder dead): do not relaunch; tell the
     user exactly what is needed.
   - **HALT** (cost cap crossed): do not relaunch; tell the user the cap must be
     raised and what the act has spent.
   - **Neither** (container froze mid-run): relaunch per step 5.
4. **Report only what matters.** `python3 scripts/longitude_xl_report.py daily
   --since-last`, plus the health watch (`model_calls` for `provider='openrouter'`
   from the live attempt's first id: totals, failures, aborted, mean latency).
   Message the user ONLY if aborted calls exceed 2 % of OpenRouter calls (G-20)
   or a non-battery day exceeds 250 s wall-clock (battery days run ~290 s).
   Otherwise just print the numbers.
   - **Rate-limit window:** the `at` column's DATE is the *simulated* day, so
     never filter it by wall-clock. Use the newest rows instead:
     `... where provider='openrouter' and id > (select max(id) from model_calls) - 2500 group by minute having failures > 0`.
     G-25 is fixed on this build (same-target backoff), so a failed row means the
     retries were exhausted too. A window is NEVER a reason to change the
     configuration mid-act or to relaunch a running harness. Still ongoing after
     30 minutes, or the day guard halted on it → tell the user with the
     per-minute counts and the two options (wait it out / preserve this attempt,
     restore day 1000 and restart with a second fast-role target). A window that
     cleared by itself goes in the ops log with the simulated days and the facts
     written inside it (`state.json` `delivered`/`retaught` equal to those days).
   - **Instruments:** sum `empty_replies`, `recap_noops`, `recap_retried_ok`
     over `metrics.jsonl` rows with day ≥ 1001 (G-24/G-25).
   - **Consolidation watch (G-28):** `select count(*) nights,
     sum((payload->>'duplicatesMerged')::int) merged,
     sum((payload->>'mergesRefused')::int) refused from audit_log where
     event='memory_consolidated' and seq > 28877`. Attempt 3 ran 3 merges in 31
     nights, 2 of them wrong. A night with `merged > 0` deserves a look at the
     `fact_merged_by_consolidation` rows and the sleep-cycle episode notes; a
     merge across different attributes is a NEW ledger finding — record it,
     never patch mid-act.
   - **D-0052 arc (T8):** `curl -s http://127.0.0.1:4160/core/reasoning/autotune`
     plus `state.json` repins/pending_repin. The day-1010 late pin should be
     overridden at 24 contradictions WITH an `announcements` row
     `source='sleep-cycle'` (G-27 fixed), then the harness re-pins (#4, bar 30).
     Record each override with its tally in the runbook ops log.
5. **Relaunch** (only when step 3 allows it): `make db-up` if Postgres is down,
   `bash /tmp/longitude_xl/restart_embedder.sh` and wait for
   `http://127.0.0.1:9302/v1/models`, then
   `cd /home/user/J.A.R.V.I.S && XL_COST_CAP_USD=450 setsid nohup python3 -u scripts/longitude_xl.py 1500 >> /tmp/longitude_xl/run.log 2>&1 < /dev/null & disown`.
   It resumes from the checkpoint and restarts the kernel itself. The kernel must
   run the CURRENT `services/kernel/dist` — never rebuild mid-act. Append the
   resume time to the ops log, re-arm a Monitor on the log
   (`^DAY |quiz=|HALT|FATAL|Traceback|LONGITUDE-XL COMPLETE|\[resume\]|\[restart\]|\[pin\]|\[recap-miss\]|\[empty-reply\]|KEEP`),
   and re-create the 20-minute keepalive cron if `CronList` shows none. After a
   credit halt, tell the user in one line that the act resumed.
6. **Every 100 days** (1100, 1200, 1300, 1400, 1500): `bash
   scripts/longitude_xl_preserve.sh day<N>`, commit + push, republish the
   Longitude Ledger (json → `scripts/longitude_xl_ledger.html` `__DATA__` →
   Artifact publish of the scratchpad copy, same path keeps the URL), and record
   wall-clock, spend, aborted calls, the instruments and the consolidation watch
   in the runbook ops log.
7. **At the end** (last line `LONGITUDE-XL COMPLETE`, `next_day` 1501): preserve
   day1500, republish, and write `docs/verification/LONGITUDE_XL_ACT3_<date>.md`
   against T1–T12 — both rubrics, every target met or missed stated plainly; the
   model change from Sonnet 5 / Haiku 4.5 to the Qwen pair disclosed up front
   (act three vs act two is kernel refinements PLUS a model change); attempts
   1–3 disclosed as preserved-and-excluded with what each surfaced (D-0082 cost,
   G-23, G-25/26/27/28); strict-class breakdown of every miss by layer; re-taught
   facts with the G-24 instrument counts; chapter-three facts; two-hop;
   nicknames (T5 on the fixed alias path); retirements; G-09 promotions and junk
   controls; the G-10 pin/override arc with its announcements; fabrications;
   audit chain; aborted judge calls (G-20); G-21 duplicate-row misses separated
   out of T1/T2; the G-22 re-score with both as-run and re-scored figures; the
   consolidation watch against attempt 3; cost and wall-clock against act two and
   the earlier attempts. Then close the remaining gap-ledger rows, update the
   decision log / plan / parity matrix / traceability / CLAUDE.md files, commit,
   push, disable the Routine (`update_trigger enabled=false`) and delete the
   keepalive cron.

## Standing limits

Never touch `jarvis_xl` or `/tmp/longitude_xl` except through the harness, the
preserve script and read-only queries. Never reset the world. Do not message the
user unless something needs their decision.
