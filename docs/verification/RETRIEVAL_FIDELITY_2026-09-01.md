# Retrieval fidelity (D-0080) — implementation & verification record

**Date:** 2026-09-01 · **Spec:** `docs/RETRIEVAL_FIDELITY_SPEC.md` (D-0080) · **Branch:** `claude/jarvis-local-ai-os-4smuhd`
**Method:** spec-driven slices S0–S4, each = tests first → implementation → full `make test` regression → manual check on Sonnet 5 → commit. Nothing in the preserved `jarvis_xl` world was changed except the one disclosed retroactive-hygiene call (C3).

## 0. What was wrong (from Longitude-XL, 500 days, 978 scored recalls)

| Defect | Where | Evidence |
|---|---|---|
| A — similarity beats identity | `EntityMemory.recallGraph` ran lexical name-matching only when the vector search returned **nothing**; a live embedder always returns neighbours, so `optics vendor two` seeded `optics vendor` | 64% of misses; lexical-only run 96.2% vs semantic 85.9% on identical days |
| B — update coherence | `memory.correct` searched entity facts only; a preference-routed value was invisible, so flips were dropped or written as a new fact while the preference kept the stale value; rare batch skips | 11 of 15 write-class misses had flip announcements; `tessa novak` second statement never written |
| C — generic-term promotion | judge returned activity words (`tuning`); deterministic fallback promoted filler when the judge was dead | 6 junk topics in the 180-day outage window; `tuning` learned |
| D — dup-tidy over-fire | single-token keys subset-matched every key sharing the token | `preferred_alloy` vs `alloy_supplier_assigned_number` proposed as the same thing |

## 1. Instrument (S0) — replay over the preserved misses

`scripts/longitude_replay.py` re-asks the 55 unique missed facts through the kernel's recall endpoints against the day-500 snapshot (scratch DB `jarvis_fidelity`), zero LLM cost, classifying each as surfaced-by-graph / in-graph-but-missed / prefs-only / absent, plus seed[0]==asked-entity precision.

| Arm | surfaced by graph | in graph, graph missed | prefs only | absent | seed[0] == topic |
|---|---|---|---|---|---|
| baseline (pre-fix code) | 37 | **2** | 5 | 11 | **13** |
| S1 identity-first | 38 | **0** | 5 | 12 | **20** (+54 % ≥ the +50 % gate) |
| S4 final build (same DB after the mini-life rounds, so no longer pristine) | 36 | **0** | 7 | 12 | **20** |

Files: `docs/verification/longitude_xl/replay_baseline.json`, `replay_s1_identity_first.json`, `replay_s4_final.json`.
(The prefs-only and absent rows are Defect B write-side misses; the graph cannot see them by design — S4 addresses the write.)
The two rows that moved from "surfaced" to "prefs only" between S1 and S4 (`drone survey` 68.0, `tidal model north` 79.0) are the instrument's known leniency, not a retrieval change: in S1 the truth string was found inside a *neighbouring* entity's unrelated fact ("North is an optics vendor with assigned number 24"); the mini-life entities now occupy those similarity slots, and neither entity ever held the value as a fact (exact probe: no such fact) — the value lives only in a preference, which is the correct class. True graph misses stay 0 and seed precision stays 20 on the S4 build.

## 2. Slices

### S1 — identity-first hybrid seeding (R-MEM-07) · commit `e6e56b0`
`identityMatch()` (word-boundary, ≥2 tokens or ≥5 chars, longest name first) seeds `recallGraph` **before** similarity hits; `mode: hybrid|semantic|lexical`; `seeds[].via`; seed facts ranked by the query's terms (cap 8) so an entity with many facts still shows the asked one; knob `memory.recall.identityFirst` (default on, catalogued, D-0053). Tool descriptions sharpened (`memory.recall` "BY EXACT NAME", `memory.recallGraph` "NAMED in the query seed first…"). 7 tests. Manual Sonnet-5: agent answers for the neighbour-precision cases correct.

### S2 — dup-tidy token-overlap guard (Defect D) · commit `068fc80`
Near-duplicate ⇔ exact single-token equality, or ≥2 shared tokens with both keys ≥2 tokens and one containing the other (§7.2). 4 tests. Deterministic; no model check needed.

### S3 — judge-confirmed promotion (R-MEM-10) · commit `ad20dd3`
Candidates carry `{count, judged}`; promotion needs `count ≥ 2 ∧ judged ≥ 1`; the fallback accumulates but never promotes; legacy numeric maps read as `judged = 0`; ledger bounded at 200; `recordCorrection → {promoted, noted, deferred}`; the loop announces deferral honestly ("I'll learn that topic once my judgment model is available") while still journaling an override. Template clause: subject domain, never an activity/method/process word. `tuning` removed from `jarvis_xl` via `DELETE /core/reasoning/topics/tuning` (audit seq 14574, prior row superseded). 13 tests. Manual Sonnet-5 record: `retrieval_fidelity/S3_manual_sonnet5.md` — judge returned `tokamak`/`containment field` not `tuning`; judge-off ×2 accumulated `{2,0}` with the deferral note and promoted nothing; judge-on promoted `vibranium` on one confirmed mention.

### S4 — route-agnostic correction + batch remember (R-MEM-08/09) · commit `6b3a7b5`
`memory.correct`: factId → entity-fact text → **preference whose normalized key ⊇ subject tokens** (ranked by the `replaces` hint; ties refused, nothing written) → new fact; steps 1–2 are a read-only probe (`EntityMemory.correctionTargets`) so no write precedes the preference check; `route: fact|preference` reported; optional `value` for the bare preference value. `memory.rememberFacts(entity, statements[])`: one LOW_REVERSIBLE call, each statement written and re-read (`factById`), per-item `{stored, factId|error}`, `ok:false` on any failure with the failing items named, rollback forgets exactly what landed. Descriptions steer updates to `correct` and multi-item teaching to the batch. 13 tests.

**Flip mini-life on Sonnet 5** (fidelity kernel, same `/agent/run` path as Longitude-XL; record `retrieval_fidelity/S4_minilife_sonnet5.md`): _filled in below_.

## 3. Regression
`make test` after each slice, no skips: S1 454 · S2 457 (+1 semantic-suite race, hardened in `21d427d`) · S3 466 · S4 **479/479**.

## 4. Second act
Pre-registered field verification = Longitude-XL days 501–1000 on this kernel (`docs/RETRIEVAL_FIDELITY_SPEC.md §11`): attribute recall ≥ +5 pp over the first act's 87.9 %, multi-hop baseline from the relationship layer, zero fabrications / D-0052 / lab discipline must hold. Runs as S6.
