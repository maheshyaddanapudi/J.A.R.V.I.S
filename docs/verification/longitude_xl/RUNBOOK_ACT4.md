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

### 2026-09-16 06:09 UTC — false-alive caught, relaunched from day 1555

The wake's liveness check reported "harness ALIVE" on a **dead** harness:
`pgrep -f "longitude_xl.py 2000"` matched the wake command's own `bash -c`
wrapper, whose command string contains the pattern. Kernel and embedder were
down and `run.log` was 56 minutes stale. Caught by cross-checking the mtime.

Replaced with `scripts/longitude_xl/check.sh` (deployed to
`/tmp/longitude_xl/check.sh`), which matches the python executable via
`ps -C python3` and prints the log mtime against the wall clock. `ROUTINE_ACT3.md`
step 1 now mandates it. Nothing was lost — days 1553–1554 had committed before
the recycle and the checkpoint resumed cleanly at 1555.

### 2026-09-16 08:50 UTC — keepalive works; day-1600 preserve + first per-kind read

Two 50-minute keepalive windows, **0 relaunches each**, container up 1:42
continuously: days 1557→1605, **49 simulated days in 100 minutes** against the
2 days/hour the recycle pattern was yielding. Remaining ~395 days project to
~13 h of runtime rather than 9+ days of wall clock.

Preserve `day1600/` written at day 1605 (34 MB), same six-file shape as
day1300–day1500.

**First per-kind read** (`longitude_xl_rescore.py`, 298 act-four answers), the
pre-registered targets — derived from the per-answer classifier, NOT from the
`quiz_*_asked`/`quiz_*_strict` counters, per the scoring rule above:

| kind | n | lenient | strict | target | act three |
|---|---|---|---|---|---|
| hop (T4′) | 30 | 100 % | **93.3 %** | ≥ 90 % ✅ | 88.0 % |
| alias (T5′) | 10 | 100 % | **100 %** | 100 % ✅ | 86.0 % |
| retired (T6′) | 10 | 100 % | **100 %** | ≥ 95 % ✅ | 82.0 % |
| new (control) | 30 | 100 % | 100 % | — | 202/202 |
| base (old world) | 218 | 97.2 % | 97.2 % | — | — |
| **total** | **298** | **98.0 %** | **97.3 %** | — | 96.2 / 94.8 |

**0 fabrications in 298 answers.** The 8 strict misses: 2 honest "not found",
3 twin substitutions, 3 wrong-but-real values.

**These are on track, NOT established.** T5′ and T6′ rest on 10 answers each
against act three's 50 — a single miss takes T5′ off 100 %. Re-read at day 1700.

Instrument note: the first fabrication check written for this read was wrong in
the dangerous direction. It asked "does the answer contain a value from the
fact's pool?", which marks a "not found" answer — one that states no value at
all — as invented, and cannot apply to two-hop rows, which answer with a place
name and have no value pool. It printed FABRICATION against 3 rows. The correct
question is whether a STATED term is invented (in no pool, matching no known
entity); the answer is 0. Any future fabrication count must be computed that way
— a false alarm against the 0-fabrications claim is worse than no check.

### 2026-09-16 12:11 UTC — day-1700 preserve + second per-kind read

Preserve `day1700/` at day 1702 (36 MB). Sample doubled to 598 act-four answers.

| kind | n | strict | at day 1605 | target |
|---|---|---|---|---|
| hop (T4′) | 60 | **96.7 %** | 93.3 % (n=30) | ≥ 90 % ✅ |
| alias (T5′) | 20 | **95.0 %** | 100 % (n=10) | 100 % ⚠️ |
| retired (T6′) | 20 | **100 %** | 100 % (n=10) | ≥ 95 % ✅ |
| new (control) | 60 | 100 % | 100 % | — |
| base (old world) | 438 | 96.1 % | 97.2 % | — |
| **total** | **598** | **96.7 %** | 97.3 % | act three 94.8 % |

**0 fabrications in 598 answers** (stated-term test, not the pool test).

#### The single alias miss, traced — a legacy handle, not a regression

Day 1690 `What is the ravi's meets on?` → "not found — no record of a 'ravi'".
`ravi` is a **chapter-two** handle (`EXPANSION['aliases']`, taught simulated day
607, during act two) on a kernel build that had **no alias write path at all** —
`EntityMemory.addAlias` arrived with G-26 in D-0084, after act two ran. The live
entity `Ravi Lindholm` has `aliases = None`: the alias was never storable, and
`identityMatch`'s short-name gate (≥5 chars or ≥2 tokens) stops a 4-letter first
name resolving incidentally. Day 1580 answered the same question correctly and
day 1690 did not — inconsistent because nothing is stored to be consistent about.

Audit confirms the write path is healthy on this build: `entity_alias_added` for
all four chapter-three handles (jiro/lucan/rashid/halvard) and all four
chapter-four handles (nerissa/osric/pilar/freja), each read back. The eight
`entity_alias_retracted` rows are dated 2026-09-14T20:29 — the R15 pass, run
BEFORE the act launched, not mid-act behaviour.

Split by provenance:

| handles | taught | strict |
|---|---|---|
| fresh (ch3 + ch4) | on THIS build, via G-26 | **18/18 (100 %)** |
| legacy (ch2: ravi, pavel, theo, hiro) | before the alias path existed | **1/2 (50 %)** |

T5′ was pre-registered as "nicknames on **fresh handles**", so on its own written
terms it is 18/18 and met — that wording predates the act and is not a post-hoc
rescue. But the honest headline next to act three's 86.0 % is **19/20 (95.0 %)
across all alias rows**. This corroborates act three's own diagnosis (T5 missed
"because the alias path did not exist before G-26", recovering to 92.5 % once
chapter three's handles flowed); the mechanism is now isolated cleanly — legacy
handles are unrecoverable without a re-teach, fresh ones are perfect.
