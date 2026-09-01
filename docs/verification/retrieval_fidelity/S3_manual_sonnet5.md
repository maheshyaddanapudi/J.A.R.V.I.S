# D-0080 S3 — manual check on Sonnet 5 (2026-09-01)

Kernel: fidelity kernel `:4170` on `jarvis_fidelity` (a copy of the Longitude-XL day-500
snapshot), all gateway roles → Sonnet 5, real local embedder. Build: S3 tree
(`recordCorrection` judged-count gate, deferral notice in the loop, C1 template clause).
Every turn below was sent through `POST /core/converse` with `reasoning: "deep"` on a
turn the auto assessment rates fast — i.e. a learning-by-correction event — and the
candidate ledger (`reasoning_deep_candidates`) + topic list were read back after each.

## Before
```
topics:     [plasma containment, orbital rendezvous, orbital mechanics, battery chemistry,
             coral genetics, glacier dynamics, antenna arrays]          (tuning already removed, C3)
candidates: {"magnetic confinement":1,"electrochemistry tuning":1,"genetic tuning":1,
             "minute":1,"worth":1,"option":1}                            (legacy numeric map)
```
Note the legacy ledger itself is the defect's fingerprint: two judge outputs carrying the
activity word (`… tuning`) and three fallback filler words (`minute`, `worth`, `option`)
from the dead-model window.

## C1 — live judge on ACTIVITY phrasing (`tuning` must not be the topic)
Turn ×2: *"How would you approach tuning the containment field on the tokamak?"*

| # | decision `why` | ledger after |
|---|---|---|
| 1 | explicitly requested | `tokamak {count 1, judged 1}`, `containment field {count 1, judged 1}` — **no `tuning`**; legacy rows migrated to `{count n, judged 0}` |
| 2 | explicitly requested — noted, I'll think deeply about 'tokamak', 'containment field' from now on | both promoted (count 2, judged 2) |

The Sonnet-5 judge returned the subject domain, not the activity word, on both turns.

## C1b — routine question forced deep (must learn nothing)
Turn ×2: *"Should I take an umbrella if the sky looks grey?"* → `why: explicitly requested`
both times, ledger unchanged, topics unchanged (judge returned `[]`).

## C2 — judge OFF (`PUT /settings/memory.llmJudgment = false`) → accumulate, never promote
Turn ×2: *"check the vibranium shield tolerances"*

| # | decision `why` | ledger after |
|---|---|---|
| 1 | explicitly requested — **noted; I'll learn that topic once my judgment model is available** | `check/vibranium/shield/tolerances {count 1, judged 0}` |
| 2 | same deferral notice | all four `{count 2, judged 0}` |

Topics after: unchanged — **`vibranium` not promoted** although its count reached the
pre-D-0080 bar of 2. (Before this slice the second turn would have promoted `vibranium`,
`check`, `shield` and `tolerances` alike.)

## C2b — judge back ON (`DELETE /settings/memory.llmJudgment` → default true)
Turn: *"vibranium shield tolerances once more"* → judge returned `vibranium`, `material
tolerances` → `why: explicitly requested — noted, I'll think deeply about 'vibranium' from
now on`. Ledger: `vibranium` removed (promoted at count 3, judged 1); `material tolerances
{1,1}` new; `check/shield/tolerances` remain `{2, 0}` — parked, unable to promote until a
judge ever names them.

## C3 — retroactive hygiene
`DELETE /core/reasoning/topics/tuning` → 200 on the fidelity copy **and** on the preserved
`jarvis_xl` (XL kernel started on the S3 build for the call only, then stopped; the
`reasoning_deep_topics` preference gained a new active row with provenance
`user-instruction`, prior row superseded — history kept). See the S3 commit for the trail.

## Verdict
C1, C2, C3 behave as specified (§6.2) on the real model; no fix-and-repeat needed.
Regression: full kernel suite 466/466 (`make test`), 23 reasoning + 17 longitude-fixes tests.
