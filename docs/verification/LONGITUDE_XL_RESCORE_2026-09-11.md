# Longitude-XL — strict re-score of all 100 batteries (2026-09-11, gap G-13)

**What this is.** The run scored every battery leniently: the truth's words as
substrings anywhere in the answer segment, no not-found phrase in the first
120 characters. That rubric was applied identically to both acts, so the
first-act-vs-second-act comparison was fair, but the absolute numbers were
known to be generous. This record re-scores the **same 2,166 raw answers**
(kept for exactly this purpose) under a strict rubric and reports both.

**Policy.** The strict score is **monotone** — a record can only move from hit
to miss, never the other way — so re-scoring cannot inflate anything. The one
answer the lenient rule wrongly counted as a miss is noted below and stays a
miss in every headline. The pre-registered targets were set against the
lenient rubric; the lenient numbers remain the headline of the second-act
record and the strict numbers are reported as corroboration, not replacement.
The strict scorer is adopted for the third act.

**Instrument:** `scripts/longitude_xl_rescore.py` (deterministic, no model
calls, ~2 s). Per-record output with the full answer, both scores, the strict
class and the reason: `docs/verification/longitude_xl/rescore_strict.jsonl`.

## Strict rubric

The answer must **state the truth as the answer for the asked entity**:

1. whole-phrase match, word-bounded ("3" is not "13", "lakeside cabin" is not
   "lakeside cabin north");
2. the asked entity is the one answered — naming only a longer twin
   (`X two` / `X north`) is a **twin substitution**;
3. the **stated value** is the first value of the fact's pool in the answer,
   skipping any value mentioned only as history ("previously", "older
   record"), unless a commitment phrase ("answer: X", "most likely X",
   "treating X as authoritative", "so: X") names another. A stated value other
   than the truth is **wrong**; if the truth appears elsewhere — as history or
   as another item's value — it is **misattributed**. A note about a
   *different* named item ("… (a separate `weekend_…` is teal)") is not a hedge;
4. a stated truth accompanied by a conflict phrase *before* it ("conflicting
   values found — 42 vs 68") or an explicit non-commitment ("cannot confirm",
   "please clarify", "not a single answer") and no commitment is a **hedge** —
   the agent named the value but did not answer;
5. an answer that **opens** with a not-found phrase is a declared miss whatever
   follows (the truth, if present, is being attributed to something else);
6. two-hop: the device hop must be the asked device — a twin or a different
   device is not — and the stated place is the one after "located at/in" (the
   last plain statement; "located in both X and Y" with no later commitment is
   a hedge);
7. retirements: the exact retired entity must be the one described, plus a
   closed-word.

The rubric was tuned on samples of every class until each sampled downgrade
was a genuine miss and each sampled annotated answer ("olive — note: a
separate weekend colour is teal") passed; the four tuning passes are in the
session record, the final rubric is the one in the script.

## Result

| Target | Lenient (as run, pre-registered) | Strict |
|---|---|---|
| First act attribute recall (baseline) | 87.9 % | **82.4 %** |
| Second act, all facts | 93.0 % (+5.1 pp) | **90.4 % (+8.0 pp)** |
| Second act, old-world facts only | 91.3 % (+3.4 pp) | **87.7 % (+5.3 pp)** |
| Second act, chapter-two facts | 97.5 % | 97.5 % |
| Two-hop | 89.8 % | **63.9 %** |
| ≥ +5 pp met (all facts / old world) | yes / no | **yes / yes** |

Under the strict rubric the second act's improvement is *larger*, not smaller,
and the old-world target is met (+5.3 pp) that the lenient rubric had missed
(+3.4 pp). The reason is in the downgrades: the first act contained **32
uncommitted answers** ("conflicting values found — graph says 42, preferences
say 68, cannot resolve") and **22 misattributed ones** (the stated value was a
twin's or a stale one and the truth appeared only in a note), all credited by
the lenient rule. Those are the two-homes defect (G-03) and the twin family
(G-02) *in the first act*, which the fixes reduced in the second: 13 hedges and
30 misattributed over 500 days against 32 and 22, with the second act asking
19 % more single-hop questions. The chapter-two number does not move at all:
facts the fixed kernel wrote itself are answered cleanly.

**Two-hop recall is 63.9 % strict, not 89.8 %.** The lenient rule credited 22
answers that traversed a twin (`kiln` → `kiln north`, `aquarium rig` →
`aquarium rig two`, `microscope` → `microscope two`) and 7 that named two
locations. 63.9 % is the honest multi-hop baseline for the third act.

**Nicknames: 21/26 strict.** Three of the four chapter-two handles collide
with another person's first name — not only "pavel" (three Pavels) but "theo"
(Theo Eriksen / Theo Kowalski) and "hiro" (Hiro Hoffmann / Hiro Ivanova). The
agent's "two matches, which one?" answers were lenient hits whenever the truth
day appeared among the candidates; strictly they are hedges. Only "ravi" is a
clean handle. G-12 is widened accordingly; the chapter-three generator must
check first names across *both* chapters.

## What the strict misses are (second act, 156 of 1,188)

| Class | Old world | Chapter two | Nickname | pavel | Retired | Two-hop | Total |
|---|---|---|---|---|---|---|---|
| honest "not found" | 42 | 7 | 0 | 0 | 1 | 1 | 51 |
| wrong value stated | 20 | 0 | 0 | 10 | 0 | 5 | 35 |
| misattributed (truth present as history / another item's) | 16 | 0 | 4 | 4 | 0 | 7 | 31 |
| twin substitution | 1 | 0 | 0 | 0 | 1 | 22 | 24 |
| hedge (named, not committed) | 10 | 0 | 1 | 0 | 0 | 3 | 14 |
| no match | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| **total** | **89** | **7** | **5** | **14** | **2** | **39** | **156** |

Re-attribution for the gap ledger (single-hop old world, 89 misses): G-01
never-stored 42; G-03 two homes (hedge + misattributed + stale wrong) ≈ 40;
G-02 twin 1; the remaining wrong values are the twin's value stated outright,
which the entity trace below explains.

## Finding: the kernel merged distinct twins as aliases

Tracing why "coral census" is answered from `coral census two` **every single
time** (5/5, both rubrics) led to the entity table, not the read path:

```
Coral Census Two      aliases {"coral census"}      ("coral census" row: superseded)
Microscope Two        aliases {"microscope"}
Aquarium Rig Two      aliases {"aquarium rig"}
Rooftop Garden Two    aliases {"roof array","roof array two"}
kiln north            aliases {"kiln","the kiln"}
Lakeside Cabin North  aliases {"lakeside cabin"}
glacier telemetry north aliases {"glacier telemetry"}
sensor importer north aliases {"sensor importer two"}
seed vault            aliases {"seed bank"}         ("seed bank" row: superseded)
catering service two, cold cellar two, the test range, 3D printer north, …
```

29 of the 179 active entities carry aliases, and the aliases are the *shorter
twins* — real, separately-taught entities with their own facts, whose own
rows are now `superseded`. The D-0075 name-variant resolution
(`EntityMemory.resolveCanonical`) has two paths: an exact-or-alias hit, and
otherwise a judge verdict over lexically similar candidates. The judge
template asks it to be conservative but gives "a short name vs its full name
('Pepper' ⇄ 'Pepper Potts')" as the model case of SAME — which is exactly the
shape `coral census` ⇄ `coral census two`. 161 entity-resolution judge calls
ran over the life; once one of them said SAME, the shorter name became an
alias, its row was superseded into the twin, and every later exact lookup of
"coral census" resolved to the twin *by design* — the twin's value is then
stated with full confidence, which is why these are wrong values rather than
honest misses. The merge direction is visible in the audit trail: the merge
happened when the *twin* was first taught (`entity_remembered` name "Coral
Census Two", `resolvedFrom` "Coral Census Two" — a judge verdict against the
existing candidate "coral census"; likewise "kiln north" absorbing "the kiln",
"seed vault" absorbing "seed bank", "sensor importer north" absorbing "Sensor
Importer Two"). The only trace is that one field on 29 audit events; nothing
was announced, so nothing surfaced it in 1000 days. This is one root cause behind G-02, G-04 and
G-16 together (the twin family), and it is a *write-side* defect: identity-first
seeding (D-0080 S1) cannot help when the store itself says the two names are
one entity. Recorded as **G-17** in the gap ledger; the fix belongs to R3 —
the resolver must treat a qualifier-token difference (`X` vs `X two` / `X
north` / `the X`) as DIFFERENT unless the judge affirms identity with evidence
beyond the name and the shorter name has no entity of its own; alias merges
must be audited and announced; and the day-1000 world's twin aliases must be
split back into their own entities with history.

## Instrument note

One lenient false miss: day 460, "morning swim's status colour: **crimson**
(from preference …; not found as a graph entity)" — the not-found phrase inside
the first 120 characters made the lenient rule score a correct answer as a
miss. It stays a miss everywhere; the strict scorer's clause-level negation
would score it correctly, and the third act uses that scorer.

## Generated tables

The full generated output follows (regenerate with the script).

---

# Strict re-score of 2166 scored answers (days 10–1000)

Records: 2166 · lenient hits 1955 · strict hits 1838 · downgrades 117 · lenient false misses (noted, not added back) 1

## Pre-registered targets, both rubrics

| Target | Lenient (as run) | Strict |
|---|---|---|
| First act attribute recall (baseline) | 87.9% | 82.4% |
| Second act, all facts | 93.0% (+5.1 pp) | 90.4% (+8.0 pp) |
| Second act, old-world facts only | 91.3% (+3.4 pp) | 87.7% (+5.3 pp) |
| Second act, chapter-two facts | 268/275 (97.5%) | 268/275 (97.5%) |
| Two-hop | 97/108 (89.8%) | 69/108 (63.9%) |
| ≥ +5 pp met (all facts / old world) | yes / no | yes / yes |

## By layer (second act) — lenient | strict

| Layer | Lenient | Strict |
|---|---|---|
| Old world | 662/725 (91.3%) | 636/725 (87.7%) |
| Chapter two | 268/275 (97.5%) | 268/275 (97.5%) |
| Nicknames (excl. pavel) | 26/26 (100.0%) | 21/26 (80.8%) |
| pavel | 4/14 (28.6%) | 0/14 (0.0%) |
| Retirements | 38/40 (95.0%) | 38/40 (95.0%) |
| Two-hop | 97/108 (89.8%) | 69/108 (63.9%) |
| All | 1095/1188 (92.2%) | 1032/1188 (86.9%) |

## By 100-day block — lenient | strict

| Block | Lenient | Strict | Downgrades |
|---|---|---|---|
| 1–100 | 154/178 (86.5%) | 154/178 (86.5%) | 0 |
| 101–200 | 174/200 (87.0%) | 163/200 (81.5%) | 11 |
| 201–300 | 178/200 (89.0%) | 164/200 (82.0%) | 14 |
| 301–400 | 179/200 (89.5%) | 164/200 (82.0%) | 15 |
| 401–500 | 175/200 (87.5%) | 161/200 (80.5%) | 14 |
| 501–600 | 186/200 (93.0%) | 183/200 (91.5%) | 3 |
| 601–700 | 221/238 (92.9%) | 215/238 (90.3%) | 6 |
| 701–800 | 226/250 (90.4%) | 211/250 (84.4%) | 15 |
| 801–900 | 233/250 (93.2%) | 215/250 (86.0%) | 18 |
| 901–1000 | 229/250 (91.6%) | 208/250 (83.2%) | 21 |

## Downgrades (lenient hit → strict miss) by class and act

| Class | First act | Second act | Meaning |
|---|---|---|---|
| misattributed | 22 | 30 | another value stated; the truth appears only as history or as another item's value — G-03 / twins |
| hedge | 32 | 13 | the truth was named but not committed to (conflicting records, please clarify) — G-03 |
| twin | 0 | 19 | answered about a longer twin (X two / X north) — G-02/G-04/G-16 |
| wrong | 0 | 1 | another value stated, the truth absent |

## Every strict miss in the second act by class and layer

| Class | Old world | Chapter two | Nickname | pavel | Retired | Two-hop | Total |
|---|---|---|---|---|---|---|---|
| honest | 42 | 7 | 0 | 0 | 1 | 1 | 51 |
| wrong | 20 | 0 | 0 | 10 | 0 | 5 | 35 |
| misattributed | 16 | 0 | 4 | 4 | 0 | 7 | 31 |
| twin | 1 | 0 | 0 | 0 | 1 | 22 | 24 |
| hedge | 10 | 0 | 1 | 0 | 0 | 3 | 14 |
| nomatch | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| **total** | 89 | 7 | 5 | 14 | 2 | 39 | 156 |

## Lenient false misses (instrument note; NOT added back)

1 answers stated the correct value but were scored as misses because a not-found phrase appeared in the first 120 characters (e.g. "… (from preference X; not found as a graph entity)"). They stay misses in every headline number; the strict scorer for the third act uses clause-level negation so this cannot recur.

- day 460 · morning swim → `morning swim's status colour: **crimson** (from preference `morning_swim_status_colour`; not found as a graph entity)`

Per-record output: `docs/verification/longitude_xl/rescore_strict.jsonl` (2166 rows: day, kind, lenient, strict, class, change, full answer).
