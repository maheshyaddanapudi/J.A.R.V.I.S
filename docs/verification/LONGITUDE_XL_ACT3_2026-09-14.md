# Longitude-XL — Act Three (chapter three, days 1001→1500)

**Run: 2026-09-13 18:11 → 2026-09-14 18:35 UTC. 500 simulated days, 1,348 scored
answers, ~16 h wall-clock, $11.03 of real provider spend.** World continued from
the preserved day-1000 snapshot; finished at 221 entities, 443 active facts (198
superseded), 101 preferences, 1,757 episodes, **audit chain verified intact at
39,030 entries**.

Snapshots: `longitude_xl/day1100/`, `day1200/`, `day1300/`, `day1400/`,
`day1500/` (each a full DB dump + checkpoint + every metric row + every raw quiz
answer + the log). Ops log: `longitude_xl/RUNBOOK_ACT3.md`.

---

## Read this first — what this act does and does not prove

**Two things changed between act two and act three**, so a head-to-head number
is *not* attributable to either alone:

1. **The kernel build.** G-25/26/27/28 (D-0084), then G-20/21/22 (D-0085).
2. **The models.** Act two ran Sonnet 5 (planning/deep) + Haiku 4.5 (fast). Act
   three ran Qwen 3.8 Max (planning/deep) throughout, and for the fast role —
   which also carries the D-0075 memory judge, ~85 % of all calls — **two
   different models in sequence** (see the seam below).

**There is a model seam INSIDE this act at day 1009** (D-0086). Days 1001–1008
ran the fast role on `qwen/qwen3.8-flash`; days 1009–1500 on
`inclusionai/ling-3.0-flash`. The swap was forced by an upstream rate limit, not
chosen for quality, and the user's instruction was explicitly to change the model
without restarting the act. Every figure spanning day 1009 carries this seam.

**Attempts 1–4 are preserved and EXCLUDED** from every number here
(`jarvis_xl.act3-attempt*.sql.gz`). What each surfaced: attempt 1 the D-0082 cost
and pace problem; attempt 2 G-23 (reasoning dialect); attempt 3 G-25/26/27/28;
attempt 4 the credit halt that became D-0085. One act, one build.

---

## Headline

| | lenient | strict |
|---|---|---|
| **act three (days 1001–1500)** | **1,297/1,348 (96.2 %)** | **1,278/1,348 (94.8 %)** |
| act two (published) | 93.0 % | 90.4 % |
| act one (published) | 87.9 % | — |

**No decay across 500 days**, by century (strict): 94.8 · 94.8 · 94.4 · 95.9 ·
94.1 — flat within noise while the world kept growing.

**Strict misses: 70 of 1,348.** `honest` 30 · `twin` 18 · `wrong` 17 ·
`misattributed` 5 · **fabrications 0**. The largest class is J.A.R.V.I.S.
declining to answer rather than guessing. **Zero fabrications now spans 3,514
scored answers across all three acts.**

**By kind (strict):**

| kind | result | |
|---|---|---|
| **new** — facts taught during this act | **202/202** | **100.0 %** |
| base — old-world facts | 860/896 | 96.0 % |
| hop — two-hop chains | 132/150 | 88.0 % |
| alias — nicknames | 43/50 | 86.0 % |
| retired — retirement questions | 41/50 | 82.0 % |

---

## Pre-registered targets T1–T12

Scored against the targets exactly as written in `RUNBOOK_ACT3.md` before the act
began. **8 met, 4 missed.**

| | target | result | |
|---|---|---|---|
| **T1** old-world facts never re-taught | ≥ 87.7 % | **591/620 (95.3 %)** | **MET** (+7.6 pp over the day-1000 baseline) |
| **T2** re-taught facts after their recap | ≥ 90 % | **269/276 (97.5 %)**; first battery after each recap **81/82 (98.8 %)** | **MET** — the 26 worst topics of act two, previously 0–50 %, now answer |
| **T3** chapter-three facts | ≥ 95 % | **202/202 (100.0 %)** | **MET** |
| **T4** two-hop | ≥ 85 % | **132/150 (88.0 %)** | **MET** — act two was 63.9 % strict |
| **T5** nicknames | 100 % | **43/50 (86.0 %)** | **MISSED** |
| **T6** retirements | ≥ 95 % | **41/50 (82.0 %)** | **MISSED** |
| **T7** 4/4 chapter-three deep topics promoted; 0/2 junk words | 4/4 · 0/2 | **3/4 · 0/2** | **MISSED (partial)** |
| **T8** D-0052 pin/override contract with announcement | contract holds | **holds** | **MET** |
| **T9** fabrications | 0 | **0** | **MET** |
| **T10** audit chain intact | verify ok | **intact, 39,030 entries** | **MET** |
| **T11** planning uncached input ≤ 6.3 k/step; quiz-day ≤ $0.84 | both | **10,188 tok/call; max $1.03** | **MISSED** |
| **T12** no void day committed | 0 void | **0 void; 1001→1501 no gaps** | **MET** |

### The four misses, without softening

**T5 nicknames — 86.0 %, target 100 %.** Split matters: the first century scored
6/10, the remaining four 37/40. The alias path *did not exist* in attempt 3 (every
person had `aliases = NULL`); G-26 built it and this build wrote 4 aliases via
`entity_alias_added`, the first being `jiro nwosu` → `jiro`. So the layer went
from structurally impossible to 92.5 % once the handles were flowing — but the
target said 100 % and 100 % is not what happened.

**T6 retirements — 82.0 %, target 95 %.** The weakest layer of the act. Legacy
G-16/G-19 territory: several act-two retirements were recorded as corrections or
episodes rather than as facts, so there is no active fact to answer with. Not a
regression introduced here; not fixed here either.

**T7 — 3 of 4 deep topics promoted.** `lidar calibration`, `tidal turbines` and
`ion thrusters` promoted; **`cryogenic pumps` did not.** Its two corrections fell
on **days 1006 and 1008 — inside the pre-swap rate-limit window**, where 30 % of
fast-role calls were failing and three conversational turns came back empty. The
promotion machinery was not given the corrections it needed. Attributed to the
provider window, and the window is the reason the model was swapped. Junk control
was perfect: `scheduling` and `tidying` never promoted (0/2).

**T11 cost — both halves missed, one structurally.** Planning-role uncached input
is 10,188 tokens/call against a 6.3 k target, with **cache-read tokens = 0**: the
OpenAI-compatible adapter sends no cache markers, which was disclosed as a known
consequence of the provider switch before the act began. Quiz-day spend peaked at
$1.03 against $0.84 — but that is the *world ledger at list prices*. **The real
bill was $11.03 for 492 days ($0.022/day)**, roughly 40× under the ledger's
figure. The target as written is missed; the money was never a problem.

---

## The model seam (D-0086), measured

The swap was forced: `qwen/qwen3.8-flash` is rate-limited upstream on a shared
pool, and it carried the fast role *and* the memory judge.

| | days 1001–1008 (`qwen3.8-flash`) | days 1009–1500 (`ling-3.0-flash`) |
|---|---|---|
| fast-role calls | 853 | **50,299** |
| failed | **127 (14.9 %)** | **1 (0.002 %)** |
| aborted | 27 | **1** |
| median plain day | 221 s | **~96 s** |
| empty replies | 3 | **0** |

`qwen3.8-max-0902` (planning/deep) ran 2,550 calls with **0 failures** across the
whole act, unchanged throughout.

**A measurement rule this cost us, recorded so it is not relearned:** one-token
probes do *not* reproduce this limit. Twenty of twenty idle probes returned 200,
and the very next simulated day failed 30 % of its calls. The ceiling binds on
sustained token throughput over minutes. Judge provider health from the act's own
`model_calls` rows, never from a probe.

---

## What else the act demonstrated

- **Continuity across cold starts.** Two scheduled kernel-restart drills (day
  1100, day 1300): **post-restart quiz 27/27 both times.** Plus one unscheduled
  container restart at ~day 1373 that the act rode through without losing a day,
  because the harness runs detached rather than as a child of the session.
- **G-28 slot guard in the field.** 497 quiet-hours nights: **3 merges allowed,
  5,408 refused.** All three allowed merges were legitimate post-fold duplicates
  from the launch article-reconciliation. Attempt 3's unguarded build managed 3
  merges of which 2 were wrong.
- **G-27 override relay.** The D-0052 arc ran twice end to end, each time with an
  `announcements` row carrying the change, the evidence tally, the bar cleared and
  the re-pin term — the exact thing missing in attempt 3, where the user would
  never have heard that their own setting had been changed.
- **50 batteries**, 15 of them perfect, 34 with strict equal to lenient.

---

## Findings opened during the act (for the post-act pass)

Recorded in `LONGITUDE_XL_GAP_LEDGER.md`, none patched mid-act:

- **G-29** — possessive phrases that became entities and absorbed the real person.
- **G-30** — seven rows whose canonical name begins with an article and which
  have **no plain-named row to fold into**, so D-0085's `reconcileArticleVariants`
  structurally cannot reach them.
- **G-31** — the twin split created the plain entities but left each plain name in
  its twin's alias array; six names are both an entity and an alias of their own
  twin. Latent only: exact name still beats alias, verified live.

Three harness-instrument repairs were made mid-act and disclosed
(`kernel_has_value` twice for store coverage, once for article-prefixed canonical
names). The third was **not** inert for committed days — days 1008, 1012 and 1014
carry artifact no-ops and four extra re-issued teaches — and that is named rather
than smoothed away.

## A reporting error corrected mid-act

Through the day-1100 and day-1200 preserves the "newly-taught facts N/N" figure
was derived by summing `quiz_new_hits` over `quiz_new_asked`, **two counters that
do not share a denominator**. It should have been caught the first time a strict
count exceeded its asked count. From day 1300 the figure is derived per answer
from the re-score classifier, which is the basis of the 202/202 above.
