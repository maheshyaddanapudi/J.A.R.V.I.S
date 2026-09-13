# Longitude-XL — second act: days 501–1000 (2026-09-11)

**Question:** the first act (`LONGITUDE_XL_2026-09-01.md`, days 1–500) found the
memory *store* sound (87.9 % recall, no decay, 0 fabrications) and the
read/update/calibration layer imprecise; D-0080 fixed the four localized
defects in code. This act is the **pre-registered field verification** of
those fixes (`docs/RETRIEVAL_FIDELITY_SPEC.md §11`): the same world, the same
kernel database, continued for another 500 simulated days on the fixed kernel —
with a relationship layer (multi-hop questions) and, from day 540, a second
chapter of new people, things, preferences, nicknames, retirements and
cross-links so that evolution could be observed on facts the *fixed* kernel
wrote from scratch.

**Verdict: the target is met on all facts (+5.1 pp) and not met on old-world
facts alone (+3.4 pp).** Attribute recall over days 501–1000 is **93.0 %**
(930/1000 scored single-hop facts) against 87.9 % in the first act. Split by
where a fact was born: facts the fixed kernel wrote itself (chapter two) recall
at **97.5 %**; facts inherited from the old kernel recall at **91.3 %**. The
gap between those two numbers is the honest measure of what the fixes did and
did not do: they made new writes land and new reads precise, and they could not
retroactively repair facts the old kernel never stored or stored twice.
Multi-hop baseline **89.8 %** (97/108). **Zero invented values** in 1,188
scored answers — every wrong answer is a stored value (a twin's, or a stale
one). D-0052 arc untouched; Night Lab kept discarding on evidence; the audit
chain is intact at 28,563 entries.

Continuable: the day-1000 snapshot (`docs/verification/longitude_xl/day1000/`)
restores the whole world; a third act on it is the refinement plan.

---

## 1. Method

One continuously-running kernel on `jarvis_xl`, never reseeded, resumed at day
501 from the day-500 snapshot. Same models and embedder as the first act
(**Haiku 4.5** conversation, **Sonnet 5** planning/deep, real local 768-dim
all-mpnet-base-v2), same catalog (hash `9206ceb12fd98ad6`, 178 topics / 353
facts), same nightly aging of every timestamp column, same quiz cadence (every
10 days), lab nights every 20 days, restarts at 700 and 900, a quiet stretch
at 800–830.

**Deliberate interventions at day 501** (disclosed per spec §11):
1. the **D-0080 kernel** — identity-first graph seeding, route-agnostic
   `memory.correct`, verified batch teaching, judge-confirmed learning, the
   dup-tidy guard, the mini-life guards, and the second-act audit's
   `pickPreference` rule (see §7);
2. the **relationship layer** — 96 edges over the existing world and 72
   two-hop probe shapes ("which place is the X — the one P maintains — located
   in?"), asked as part of every battery from day 610;
3. **chapter two** from day 540 (hash `10a2cef1fd90db2c`, pinned in the
   checkpoint): 46 topics / 89 facts — 20 new people, 18 new things in new kinds
   (vehicle, course, collection), 8 new first-person preferences; 26 of the
   facts flip on schedule (announced third-person: "*reporter* told me that …
   now — update your memory"); 4 nicknames adopted ~45 days after a person
   arrives; 6 long-lived base projects/devices retired on days 600–900; 20
   cross-chapter relations on days 600–790; a planning objective every 10 days
   that must traverse them.

Every battery asks 25 questions stratified by route, flip count and age, with
at most 6 chapter-two facts, plus the nickname and retirement specials and
two-hop probes when due. Each question is scored per fact against the announced
truth; raw answers are preserved in `quizzes.jsonl` for re-scoring.

## 2. Pre-registered targets (spec §11)

| Target | Pre-registered | Measured | Met |
|---|---|---|---|
| Attribute recall, second act vs first | ≥ +5 pp over 87.9 % (< +2 pp = "the fixes did not move the number") | **all facts 93.0 % (+5.1 pp)**; old-world facts only **91.3 % (+3.4 pp)** | **yes** on all facts · **no** on old-world facts (above the +2 floor) |
| Multi-hop recall | first baseline, report the number | **97/108 (89.8 %)** | recorded |
| Zero fabrications | 0 invented values | 21 wrong-value answers on single-hop facts (+10 on the ambiguous "pavel" nickname, §7) — every one a value that exists in the store; none invented | holds |
| D-0052 discipline | no unauthorised change of the user's setting | `reasoning_autotune` unchanged since day 35 (J.A.R.V.I.S.'s own threshold-1 setting; the user pinned nothing after day 24) | holds — but the arc was dormant (G-10) |
| Lab discipline | keeps reach live only via the envelopes | ledger: keep 1 · discard 65 · crash 1; applied to live: 0 | holds |
| Latency flat, guards never spurious | — | median 2,300 ms (first act 2,344), p90 3,165 ms; `assert_model_live` fired once (day 831, a real outage, §7); `assert_embeddings_live` never fired | holds |

## 3. Recall by layer (days 501–1000)

| Layer | What it is | Recall |
|---|---|---|
| Old world | the 353 first-act facts, most written by the old kernel | 662/725 (**91.3 %**) |
| Chapter two | 89 facts written by the fixed kernel from day 540 | 268/275 (**97.5 %**) |
| Nicknames | "what is the *alias*'s meets-on?" for the 3 unambiguous handles | 26/26 (100 %) |
| "pavel" | the fourth handle collides with a second Pavel — the agent's "two matches" answer is scored as a miss (instrument flaw, excluded above) | 4/14 |
| Retirements | "is the X still active?" after a retirement was taught | 38/40 (95 %) |
| Two-hop | person/supplier/dependency → device → place | 97/108 (89.8 %) |
| **All questions** | | **1,095/1,188 (92.2 %)** |

Old-world recall by fact age when asked shows **no age decay** — 100–300 days
94.9 % (37/39), 300–600 days 90.5 % (315/348), 600–1000 days 91.7 % (310/338).
Facts that had flipped at least once recall at 90.7 % (331/365) against 94.3 %
(599/635) for never-flipped facts; the gap is the two-homes family (§5).

## 4. Batteries by 100-day block

| Block | Score | Old world | Chapter two | Nickname | Retired | Two-hop | Honest misses | Wrong values |
|---|---|---|---|---|---|---|---|---|
| 1–100 (act 1) | 154/178 (87 %) | 154/178 | — | — | — | — | 19 | 5 |
| 101–200 | 174/200 (87 %) | 174/200 | — | — | — | — | 16 | 10 |
| 201–300 | 178/200 (89 %) | 178/200 | — | — | — | — | 16 | 6 |
| 301–400 | 179/200 (90 %) | 179/200 | — | — | — | — | 19 | 2 |
| 401–500 | 175/200 (88 %) | 175/200 | — | — | — | — | 21 | 4 |
| **501–600** | **186/200 (93 %)** | 152/165 | 34/35 | — | — | — | 11 | 3 |
| 601–700 | 221/238 (93 %) | 126/140 | 60/60 | 9/9 | 10/10 | 16/18 | 9 | 8 |
| 701–800 | 226/250 (90 %) | 127/140 | 57/60 | 6/6 | 10/10 | 24/30 | 13 | 11 |
| 801–900 | 233/250 (93 %) | 129/140 | 59/60 | 4/4 | 9/10 | 30/30 | 7 | 10 |
| 901–1000 | 229/250 (92 %) | 128/140 | 58/60 | 7/7 | 9/10 | 27/30 | 14 | 7 |

The step at day 501 is visible in the first block of the act (93 % against
87–90 % for every first-act block) before chapter two, nicknames, retirements
or two-hop questions existed — that block is the fixes acting on the old world
alone. Restart drills: 700 → 21/25 before, 22/25 after; 900 → 23/25 before,
21/25 after (both post-restart misses are honest "not found" on old-world
facts; nothing was lost across the restart).

## 5. What the failures actually are

93 misses in 1,188 answers. Grouped by cause, from the raw answers and the
audit log (`docs/verification/LONGITUDE_XL_GAP_LEDGER.md` carries the
per-topic evidence and the candidate refinement for each):

- **Never stored by the old kernel (G-01), the largest group.** The same
  old-world topics return as honest "not found" battery after battery —
  weekend preferred meeting day, tea order, sensor importer two, lab-glass
  supplier, glacier telemetry, irrigation controller two. The first-act
  replay instrument had already classed 11 of 55 first-act misses as absent
  from every store. Nothing in the read path can recover a fact that was never
  written; the refinement is a teach receipt on every write.
- **Two homes for one attribute (G-03).** A value corrected before D-0080 left
  a duplicate fact or an old preference; the agent now *sees* both, reports
  "conflicting records" and picks the stale one: microscope two (3/4 wrong,
  ochre vs cobalt), coral census north (3/7), sensor importer two (3/6). This
  is the read-side twin of the write-side defect the fixes closed; a
  quiet-hours reconciliation pass is the refinement.
- **Twin substitution (G-02, G-04, and the two retirement misses).** Asked
  about `coral census`, the agent answers from `coral census two` (5/5 wrong);
  seven of the eleven two-hop misses resolved the middle hop to a longer twin
  (`roof array` → `rooftop garden two` / `roof array north`, `kiln` → `kiln
  north`, `aquarium rig` → `aquarium rig two`); both retirement misses asked
  "is the kiln still active?" and looked for a status field on `kiln two` and
  `kiln north` instead of the retired `kiln`. Identity-first seeding fixed the
  graph seed; the traversal and the exact-recall fallback wording are the
  remaining levers.
- **First-person preferences written as entity facts (G-05, G-06 — chapter
  two's only recurring miss).** "My study plant is basil" and "my bike colour
  is olive" were stored by the agent as facts on things named `study plant`
  and `bike`; "my gym day is friday" on an entity named `user`. All three are
  in the store and were recalled correctly when the agent consulted the graph
  (bike colour 5/6, study plant 1/3, gym day 4/8) — the misses are the
  batteries where it consulted only the preference store, found
  `desk_plant`/`weekend_desk_plant`, and said "not found". 7 of chapter two's
  7 misses are these three facts. Refinement: route "my X is Y" to the
  preference store at write time, and let `recallPreferences` fall back to
  subject-named entity facts.
- **Conflicting relations (G-07, and 2 two-hop refusals).** Chapter two taught
  a new maintainer for `weather mast north`; relations have no supersession,
  so the agent answered "maintained by diego mbeki, not quinn ferreira — not
  found". `microscope two` carries two `located_in` links from the two
  relation layers; the agent refused rather than guess (twice) — the correct
  behaviour on bad data, scored as a miss.
- **Instrument.** The "pavel" nickname collision (10 wrong values, 4/14) and
  one truncated two-hop answer.

**Zero fabrications.** Every wrong value in the act is a value that exists in
the store for a neighbouring entity or an earlier date. No answer invented a
colour, city, number or day.

## 6. Evolution mechanisms over 1000 days

- **Chapter two landed completely**: 89/89 facts delivered and announced; the
  write guard refused six `rememberFact` update-in-disguise attempts across
  the act, each followed within seconds by a successful `memory.correct`
  (133 corrections, 0 refused). Preference-routed flips — the Defect-B shape
  that lost every one of its facts in the mini-life — landed through
  `pickPreference` (exact key, else best hint overlap, else fewer extra
  tokens; true ties refused).
- **Supersede-with-history**: 170 history rows at day 1000 (51 at day 500);
  every announced flip is a chain, none an overwrite.
- **Deep-reasoning learning**: 7 learned topics, constant since day 68
  (`tuning` removed at day 501, D-0080 S3); 9 auto-escalations in the act,
  all on learned topics; the harness's forced-deep controls (2/day) never
  promoted a junk topic after the judge-confirmed rule.
- **Sleep-cycle / D-0052**: consolidation ran nightly; the autotune setting
  J.A.R.V.I.S. chose on day 35 stood unchallenged for 965 days because the
  user never re-pinned — the override contract was *respected* but not
  *exercised* in this act (G-10; a late re-pin is scheduled for the third
  act).
- **Night Lab**: 25 nights in the act; 1 keep / 65 discards / 1 crash over the
  life; most nights halt at the 60k nightly token cap before N=3 completes
  (G-08). No keep reached live (applied 0) — the envelopes held.
- **Restarts** at 700 and 900 lost nothing (§4); **audit chain** intact,
  28,563 entries, across every restart, rewind and relaunch.
- **World at day 1000**: 179 entities · 364 active facts · 100 preferences ·
  170 history rows · 110 relations · 1,254 episodes · 1,837 vectors · 10,359
  routing decisions · 67 lab experiments · 53,198 model calls (48,706
  successful).

## 7. Incidents — instrument and operations, disclosed

None of these touched the measured system mid-experiment; the one kernel
change made during the act is item 2.

1. **Attempt 1 of the act (days 501–581) was rolled back and re-run.** Its
   audit showed `memory.correct` refusing as "ambiguous" whenever a preference
   key had a twin or a prefix (`weekend_tea_order` / `tea_order`, the key
   passed as the entity) — a selector defect in the S4 code, not the agent.
   Mid-attempt, on day 540, the provider balance ran out and the harness kept
   "running" on void calls; those days were un-aged and replayed
   deterministically (`scripts/longitude_xl_rewind.py`). Rather than continue
   an act with a known selector defect, the act was restarted from the day-500
   snapshot after the fix (`pickPreference` + prepositions as key filler,
   recorded under D-0080). Attempt 1 is preserved in full
   (`jarvis_xl.act2-attempt1-day581.sql.gz`, `*.act2-attempt1.jsonl`) and is
   not part of any number above.
2. **Chapter two begins on day 540, not 501** — it was designed after the
   act started (the user asked for new people, topics and conversations to
   observe evolution on fresh material) and pinned by hash in the checkpoint
   from its first day; the drift guard would have halted any later change to
   it.
3. **Second credit outage, day 831.** The new same-day guard
   (`assert_day_live`) halted before the day was aged or checkpointed; on
   reload the run resumed at 831 with no rewind needed — the guard did what
   the first-act incident asked for.
4. **Container idle-freezes** (several — the gap ledger counted four by day
   898, one lasting six days) cost wall-clock only;
   each resume continued from the checkpoint. A server-side hourly Routine
   relaunched the harness after freezes; a keepalive kept the container awake
   during long stretches. Both are now off.
5. **"pavel" nickname collision** — chapter two generated two people named
   Pavel and assigned "pavel" as a handle; the agent's answer ("two matches")
   is correct. Excluded from the nickname score, reported separately. Fixing
   the generator would have changed the pinned chapter hash.
6. **Scorer leniency**, unchanged from the first act: the truth string
   anywhere in the answer segment counts, two-hop questions have one chain
   shape, retirements are scored by a closed-word regex. Both acts are scored
   identically; raw answers are kept for a strict re-score (G-13).
7. **Spend**: the world's own ledger records $70.09 for the first act and
   $102.45 for the second (plain day $0.10 → $0.13; quiz days 6–8× a plain
   day). Attempt 1's spend is not in this table. Wall-clock for the act
   13.7 h of run time across the freezes (first act 7.7 h; median 94 s per
   simulated day against 43 s — chapter two, cross-link teaching, larger
   batteries; per-call latency did not move).

## 8. Verdict, honestly read

The fixes work where they can be seen working. On facts the fixed kernel wrote
itself, recall is 97.5 % and the seven misses share one cause the fixes never
targeted (a first-person preference written as an entity fact). On the old
world, recall rose 3.4 points, and every remaining miss traces to what the old
kernel left behind — facts never stored, attributes stored twice, twins the
traversal still prefers — not to the new read path returning neighbours for
exact questions, which was the first act's dominant defect and is gone from
the miss list. The pre-registered +5 is met on the act as a whole and missed
on the old-world subset; both numbers are reported.

**Cost:** $102.45 in the world's ledger (life total $172.54), 25 batteries,
1,188 scored answers, 89 new facts, 26 chapter-two flips, 4 nicknames, 6
retirements, 20 cross-links, 2 restarts, 25 lab nights.

**Artifacts:** `docs/verification/longitude_xl/day{600,700,800,900,1000}/`
(full DB dump, checkpoint, metrics, raw quiz answers, run log — each
restorable and continuable); `scripts/longitude_xl_act2_stats.py` regenerates
every table above from those rows; the daily human-readable ledger is
`scripts/longitude_xl_report.py` and the page "The Longitude Ledger"; the gap
worklist is `docs/verification/LONGITUDE_XL_GAP_LEDGER.md`.

**Next:** the refinement pass — strict re-score (G-13), then G-01…G-07 in
attributable-miss order, each with the D-0080 treatment (spec, tests from the
captured tool arguments, a Sonnet-5 mini-life), then a third act on the
day-1000 snapshot with chapter three (late deep-topic corrections G-09, a late
user re-pin G-10, unique nicknames G-12) so field verification stays on one
kernel build.
