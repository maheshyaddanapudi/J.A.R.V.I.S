# Longitude-XL — fourth act (chapter four, days 1501→1852)

**Run 2026-09-15 20:10 → 2026-09-16 18:02 UTC.** 352 simulated days on the
preserved day-1500 world, repaired by the R15 fix pass (D-0088). One kernel
build, one model set, no seam — the condition act three could not meet.

Stopped at day 1852 of a planned 2000, deliberately. See **Why it stopped**.

## Headline

**1,048 scored answers · 97.6 % lenient · 96.3 % strict · 0 fabrications ·
audit chain intact at 46,934 entries.**

Act three finished at 96.2 / 94.8; act two 93.0 / 90.4; act one 87.9.

## Pre-registered targets — 2 met, 1 met only on its own written terms

| | target | act three | **act four** | verdict |
|---|---|---|---|---|
| **T4′** two-hop on fresh chains | ≥ 90 % | 88.0 % | **96.2 %** (101/105) | **met** |
| **T5′** nicknames on fresh handles | 100 % | 86.0 % | **100 %** (31/31 fresh) · 94.3 % all rows (33/35) | **met as written; see below** |
| **T6′** retirements | ≥ 95 % | 82.0 % | **100 %** (35/35) | **met** |
| newly-taught facts (control) | — | 202/202 | **106/106** | held |
| fabrications (control) | — | 0 in 3,514 | **0 in 1,048** | held |

All three layers that failed in act three now pass. T4′ +8.2 pp, T6′ +18 pp.

### T5′ — reported as a miss on the honest headline

The pre-registered wording was "nicknames on **fresh handles**", and on fresh
handles it is **31/31, 100 %**. But the all-rows figure is **33/35 (94.3 %)**,
and that is the number that belongs beside act three's 86.0 %.

Both misses are the same two legacy handles. `ravi` and its siblings are
**chapter-two** aliases, taught around simulated day 607 on a kernel build that
had **no alias write path at all** — `EntityMemory.addAlias` arrived with G-26
in D-0084, after act two ran. `Ravi Lindholm` carries `aliases = NULL` because
the alias was never storable, and `identityMatch`'s short-name gate (≥ 5 chars
or ≥ 2 tokens) stops a 4-letter first name resolving incidentally. Day 1580
answered the question correctly and day 1690 did not — inconsistent because
nothing is stored to be consistent about.

| handles | taught | strict |
|---|---|---|
| fresh (ch3 + ch4: jiro, lucan, rashid, halvard, nerissa, osric, pilar, freja) | on THIS build, via G-26 | **31/31 (100 %)** |
| legacy (ch2: ravi, pavel, theo, hiro) | before the alias path existed | **2/4 (50 %)** |

The split was stable across all three reads (day 1605, 1702, 1810, final):
fresh never missed once, legacy never recovered. The audit confirms the write
path is healthy on this build — `entity_alias_added` for all eight fresh
handles, each read back. This corroborates act three's own diagnosis rather than
contradicting it: T5 missed there "because the alias path did not exist before
G-26", recovering to 92.5 % once chapter three's handles flowed. **Legacy
handles are unrecoverable without a re-teach** — that is the finding, and it is
a data-provenance fact, not a live defect.

## By kind

| kind | n | lenient | strict |
|---|---|---|---|
| hop | 105 | 100.0 % | 96.2 % |
| alias | 35 | 94.3 % | 94.3 % |
| retired | 35 | 100.0 % | 100.0 % |
| new | 106 | 100.0 % | 100.0 % |
| base (old world) | 767 | 97.0 % | 95.7 % |
| **total** | **1048** | **97.6 %** | **96.3 %** |

## No decay

Strict, by century: **97.3 · 96.0 · 95.7 · 96.0**. The gentle early-to-late
drift is regression to the mean off small early samples, not decay — `new` is
106/106 and `retired` 35/35 across the same span.

## The 39 strict misses

honest 13 · wrong 11 · twin 6 · misattributed 5 · hedge 3 · nomatch 1.
**0 fabrications** — measured by the stated-term test (was a term *stated as the
answer* invented, i.e. in no value pool and matching no known entity), not by
"does a pool value appear", which mislabels a "not found" answer as invented and
cannot apply to two-hop rows at all. Cumulative across four acts: **0 in 4,562**.

## Why it stopped at 1852, not 2000

Chapter four's content schedule is exhausted:

| event | last occurrence |
|---|---|
| fact teaching | day **1639** |
| alias handles | day **1629** |
| retirements | day **1820** |
| value flips | 9 remaining, last at 1949 |

From ~day 1840 the day loop still pads to 10 chats, but they are almost all
smalltalk filler that writes nothing — visible as +0 episodes/day, audit deltas
falling from ~+10 to +5, and wall time halving from ~120 s to ~50 s. (That
signature was investigated as a possible fault before being confirmed as
designed behaviour; gateway failures in the window were all timestamped before
the act launched.) The remaining 148 days would have bought ~15 more batteries
on question kinds already measured, 9 flips, and no new world events.

The OpenRouter balance was **$9.00** at the stop. Spending most of it to
re-measure a world that had stopped changing was not worth it, and the choice of
horizon was a question the user had been asked and had not yet answered — so the
run was paused rather than pushed. **Nothing is lost:** `/tmp/longitude_xl/PAUSED`
documents the stop, and the world, checkpoint, metrics and every raw answer are
preserved. The act resumes from day 1853 with the standard relaunch.

## Ops

Container recycling reclaimed the detached harness a few minutes after each
hourly wake, yielding **2 simulated days per hour**. `scripts/longitude_xl/keepalive.sh`
(guarded: relaunches nothing when `PAUSED` exists or the log carries FATAL/HALT)
holds the container warm as a session background task: **13 windows, 0
relaunches needed, container up 10+ hours unbroken, ~24 days per 50-minute
window** — a 12× improvement that turned a 9-day projection into one afternoon.

One earlier ops defect is recorded in `longitude_xl/RUNBOOK_ACT4.md`: the
liveness check reported "harness ALIVE" over a dead harness, because
`pgrep -f "longitude_xl.py 2000"` matched the wake command's own `bash -c`
wrapper. `scripts/longitude_xl/check.sh` now matches the python executable and
cross-checks the log mtime.

Act-four instruments: **1 empty reply**, 5 deep-on-auto, 0 provider failures in
352 days. Ledger-priced spend $66.33 (the ledger runs far above the real bill —
act three's ledger estimate corresponded to $0.022/day actual).

## Final world at day 1852

240 entities · 489 active facts (+238 superseded) · 106 preferences ·
2,110 episodes · 2,895 embeddings · **audit chain intact at 46,934**.

## Preserves

`day1600/` (day 1605) · `day1700/` (1702) · `day1800/` (1810) · `day1850/` (1852).
Each is restorable and continuable. **Never delete the `jarvis_xl` DB or
`/tmp/longitude_xl`.**

## Open

- **G-33 (new):** legacy chapter-two alias handles are unstored and
  unrecoverable without a re-teach. Not a live defect — the write path is
  correct on this build — but any future act reusing this world should re-teach
  `ravi`/`pavel`/`theo`/`hiro` rather than scoring them.
- G-29 / G-30 / G-31 closed by the R15 pass; G-32 closed.
- Days 1853–2000 remain available on the preserved world if the tail is ever
  wanted.
