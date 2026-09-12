# Act-three shakeout on OpenRouter / Qwen 3.8 Max — days 1001–1010, scratch world

Run 2026-09-12 20:45–21:45 UTC, **on a scratch restore only** (`jarvis_replay`,
kernel :4180, `XL_OUT=/tmp/longitude_xl_shakeout`): the preserved `jarvis_xl`
world and its checkpoint were never written. Same harness, same chapter three,
same build `76f2e6b` as the real act; the rehearsal that justified launching
D-0082.

## Result

| | |
|---|---|
| Days | 1001–1010, all committed, no crash, no halt |
| Wall-clock | 94–365 s per simulated day (median ≈ 300 s; act two 94 s) |
| OpenRouter calls | 325, **0 failed, 0 aborted** |
| Spend (world ledger) | $172.54 → $175.74 = **$3.20 for 10 days** incl. one quiz day |
| Day-1010 battery | **25/25 lenient · 23/25 strict** (3 re-taught facts, 1 chapter-three fact, 3 two-hop, 2 specials all correct) |

Both strict misses are analysed below; one is a real world-state defect (G-21),
the other is a flaw in the strict rubric itself (G-22). Neither is a failure of
the day's recall: under the corrected rubric the battery reads 24/25.

## Miss 1 — `boat shed north`, truth Bergen, answered Hobart → G-21

The answer names the cause itself: *"hobart (for the entity named exactly 'the
boat shed north'; note the separately stored 'boat shed north' — a different
row)"*. The world holds **two entity rows differing only by the article**:

```
boat shed north      facts: home city is Bergen, assigned number is 42   ← re-taught truth
the boat shed north  facts: Home city is Hobart.                          ← stale legacy row
```

`recallGraph` returns BOTH as identity seeds, `memory.lookup` shows both, and
the agent picked the stale one. Five such pairs exist in the world (`cloud
recycler`, `cloud recycler north`, `boat shed north`, `coral census north`,
`tidal model north`); **three are in the chapter-three re-teach set** and were
asked 15, 8 and 8 times respectively in act two, so this touches ≈31 questions
per 500 days and works directly against target T2.

They are **legacy, not created by this build**: the audit dates them to
2026-08-31 and 2026-09-10 (acts one and two, `entity_remembered` seq 4115,
5876, 10913), before the R3 article-variant rule existed. R3 made `findEntity`
resolve `X` ⇄ `the X` and prevents new splits — an exact lookup of "boat shed
north" does return one row — but nothing merges rows that already exist:
`reconcileHomes` works within one entity and `splitTwinAliases` splits rather
than merges.

## Miss 2 — `evening drink`, truth sencha, answered sencha → G-22 (scorer)

The answer was *"sencha (your weekend evening drink is chamomile)."* — the
correct value, stated first, with a note about the weekend twin. The strict
rubric classed it `twin` because `names_in()` blanks the longest name first:
the only occurrence of "evening drink" is inside "weekend evening drink", so
the asked entity looks absent while a twin looks present. A correct answer that
annotates its twin without repeating the asked name is scored as a substitution.
This under-scores the 28 weekend-twin preference topics systematically.

## What the act does about them (decided before day 1011)

Neither the kernel nor the live scorer is changed mid-act — the act runs on one
build and one instrument, and a relaunch after a container freeze would
otherwise score later days under a different rule than earlier ones. Instead:

- **G-21** is measured as it stands. The final record reports T1/T2 twice: as
  scored, and with the three affected re-teach topics separated out, so the
  legacy duplication is visible rather than blended into the kernel's result.
  The fix (a merge route for article-variant rows, the mirror of
  `splitTwinAliases`) lands after the act with the G-20 timeout knob.
- **G-22** is fixed in the **post-hoc re-score**, not in the running harness:
  every raw answer is preserved in full (`full` field, untruncated rows), so
  the act's headline strict numbers come from re-scoring with the corrected
  rule, and both the as-run and re-scored figures are published.

## Model-behaviour note (class M, Qwen 3.8 Max)

Of the six entities the real act created in its first seven days, four are the
designed re-teach re-homings of the G-17 unsplit twins (`coral census`,
`glacier telemetry`, `microscope`, `aquarium rig` — the re-teach doing exactly
its job). Two are noise: **`hobart` stored as a `thing`** (a value promoted to
a subject) and **`kalinda matsuda` stored as kind `thing`** rather than
`person`. At one junk entity per week of simulated time this would reach ≈70
over the act; the hourly Routine now counts entity writes whose name matches a
known value pool and reports the rate at each preserve.
