# Longitude-XL — fourth act (chapter four, days 1501→2000)

**Launched 2026-09-15 20:10 UTC** from the day-1500 checkpoint, on the world the
R15 fix pass repaired (D-0088). Chapter four pinned at day 1501, hash
`81e29522d604d863` — 59 facts / 30 topics / 4 aliases / 4 retirements / 18 cross-links.

## The question this act exists to answer

Act three could not attribute its result: **both** the kernel build and the models
changed against act two, and a model seam sat inside it at day 1009. This act runs
on **ONE build and ONE model set**, over a **repaired** world, so a movement in the
three failed layers means something.

## Pre-registered targets

| | target | act three | why it should move |
|---|---|---|---|
| **T4′** two-hop on FRESH chains | ≥ 90 % | 88.0 % | 16 of the act's 22 damaged-name misses were hops; the names are repaired |
| **T5′** nicknames on fresh handles | 100 % | 86.0 % | G-32 fixed the lookup (`the X's` resolved to nothing); G-26 the write path. R15 re-asked all 7 alias misses and got **7/7** |
| **T6′** retirements incl. the re-taught `fusion sim north` | ≥ 95 % | 82.0 % | all 9 misses were ABSENT data, re-taught on day 1504; retirements now land on chapter-THREE things this kernel wrote |
| controls | — | — | newly-taught facts (202/202), fabrications (0 in 3,514), old-world no-decay |

## Configuration — unchanged from act three's second half, deliberately

`fast_conversation` (and with it the D-0075 memory judge) on
`inclusionai/ling-3.0-flash`, `qwen/qwen3.8-flash` as the chain fallback;
`planning`/`deep_reasoning` on `qwen/qwen3.8-max-0902`. **No seam this time.**

## Budget — tight, and stated as such

Balance at launch **$17.05**; 500 days at the measured $0.03/day projects to
**≈ $15**. Roughly 13 % headroom, and per-day cost drifts up as the world grows,
so a credit halt near the end is plausible. That is safe: the day guard halts
before committing a void day and the run resumes from the checkpoint.

## Ops

Same as act three (`ROUTINE_ACT3.md` holds the procedure — look, report, relaunch
rules, credit gate, 100-day preserves). Preserves at 1600 / 1700 / 1800 / 1900 / 2000.
Chapter four has its own drift guard: an edit to the layer after day 1501 halts the run.

## Scoring rule — do NOT read the per-kind counters as ratios

`metrics.jsonl` carries `quiz_new_asked`/`quiz_new_hits`,
`quiz_ch3_asked`/`quiz_ch3_strict` and `quiz_reteach_asked`/`quiz_reteach_strict`.
**These pairs do not share a denominator.** `*_asked` is the count sampled into
that battery's *specials* pool (`len(re_sample)`, `len(ch3_sample)`), while
`*_strict` counts every fact in the WHOLE battery carrying that flag — including
ones that arrived through the ordinary attention pool. So `reteach_strict` legally
exceeds `reteach_asked` (day 1530: 7 of 3; day 1540: 6 of 3), exactly as
`quiz_new_hits` exceeded `quiz_new_asked` at day 1240 in act three — where the
invalid ratio reached two preserved reports before being caught.

The counters are useful as **numerators only** (how many facts of that kind were
answered correctly). Every per-kind rate in the act-four record must be derived at
scoring time from the per-answer classifier over `rescore`, the way act three's
valid 202/202 was — never by dividing these two fields. The harness is NOT edited
to fix this mid-act: it is instrument reporting, the underlying per-answer data is
intact, and an edit would put a seam in the middle of the act.

## Ops log

### 2026-09-16 04:1x UTC — container recycle #n, relaunched from day 1548

Container up 2 min at wake; harness, kernel and embedder all down. Restarted the
embedder, relaunched from the checkpoint. Days 1548 (112 s) and 1549 (101 s)
committed, next day 1550, spend $273.27 of the $450 cap.

First four batteries (1510 / 1520 / 1530 / 1540): **116/118 lenient (98.3 %),
115/118 strict (97.5 %)** — above act three's finishing 96.2 / 94.8. Instruments
clean: 0 empty replies, 0 deep-on-auto, no provider failures.

The recycles are the ops story of this act: each wake yields 2–5 simulated days
before the container is reclaimed, so the 500 days are pacing at days of
wall-clock rather than the ~15–20 h the day time alone would suggest.
