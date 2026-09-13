# RETRIEVAL_FIDELITY_SPEC — exact recall, coherent updates, calibrated learning (D-0080)

**Status:** PROPOSED — awaiting the docs/06 check-in. Nothing in this spec is built; the measured system is untouched since the Longitude-XL run completed.
**Generated:** 2026-09-01
**Authority:** subordinate to the binding authored docs (`docs/01`–`docs/07`) and the decision log. Requirement IDs `R-MEM-07…10` are proposed here and land in `REQUIREMENTS_TRACEABILITY.md` on approval.
**Provenance:** every defect below was found, measured, and localized by the 500-day Longitude-XL run (`docs/verification/LONGITUDE_XL_2026-09-01.md`). The evidence is in the preserved snapshot (`docs/verification/longitude_xl/` — 50 quiz batteries, 978 scored facts, raw answers, full DB).

---

## 1. What this is

Longitude-XL established that the memory **store** is sound at scale — 87.9% recall with no decay through a 10× growth, zero fabrications in 978 recalls, supersession with history, audit intact. What it also established is that the residual 12.1% of misses are not memory loss. They are four specific defects in the **read, update, and calibration** layer, each now localized to a code path:

| # | Defect | Share of misses | Root cause (file) |
|---|---|---|---|
| A | Retrieval precision — value present, not found | 64% (76/118) | `entities.ts` `recallGraph`: lexical name-match runs **only when vector search returns nothing**; with a live embedder it never runs, and vector neighbours (`optics vendor` for `optics vendor two`) seed the graph |
| B | Update coherence + batch write drops | 36% (42/118)* | flips announced for facts the agent had routed to **preferences** never reach them (`memory.correct` only knows entity facts); rarely, the 2nd statement of a multi-fact batch is never written |
| C | Generic-term promotion | latent, 0 fires | judge extraction returns activity words (`tuning`); the deterministic fallback promotes filler when the judge is unavailable (6 junk topics in the dead-model window) |
| D | Preference dup-tidy over-fires | proposals only | `memory.ts` `tidyDuplicates`: a single-token normalized key is a subset of every key containing that token |

\* The 64/36 split comes from a topic-scoped presence check; spot-checks show some "write" cases were actually present under a differently-worded statement, so **A is understated**. §9's replay instrument settles the true split before any fix is judged.

This spec fixes A–D with **measurable acceptance gates that need no new 500-day run**, then uses the already-built second act (days 501–1000, relationship layer) as field verification — where the attribute-recall metric measures the fixes and the new multi-hop metric measures the relationship layer, with no confound between them.

**Non-goals (v1):** changing the embedding model; LLM re-ranking of recall results; any change to D-0052 evidence bars, the Night Lab, or Z1; graph-DB adoption (D-0045 stands).

---

## 2. Non-negotiables inherited

1. **Honesty rule.** Retrieval never returns a value it is not confident is the asked-for entity's; "not found" remains the correct answer for a genuine gap. No fix may trade the zero-fabrication result for recall.
2. **Best-effort judge contract (D-0075).** Any path that consults the memory judge must degrade deterministically when the judge is null — but Defect C establishes a new rule: **degrade to *not learning*, never to learning *worse***.
3. **R-MEM-04.** Nothing here auto-forgets. Updates supersede with history; corrections leave `superseded_by` chains.
4. **D-0053 dual-editability.** Any new knob (there is one, §4.4) ships catalogued, ledgered, user- and J.A.R.V.I.S.-editable, Z1-excluded.
5. **Local-first, offline path intact.** Every fix works with no embedder and no judge; the lexical paths are first-class, not fallbacks.
6. **Z1 untouched.** All changes are in `src/memory/` and `src/core/reasoning.ts`'s learning path; policy/approval/audit/e-stop are not on this spec's surface.

---

## 3. Evidence summary (what the run measured)

- 978 scored facts, 118 misses; **91 of 118 said "not found" explicitly**; 0 invented values.
- Controlled comparison, identical world and days: **lexical fallback 96.2% vs semantic recall 85.9%** (75/78 vs 67/78). Semantic lost at every comparison point.
- Tool usage by the answering agent over the run: `memory.recallGraph` **1,827** calls, `memory.recall` 1,374, `memory.recallPreferences` 1,584. The imprecise path was the most-used path.
- Write tools: `memory.rememberFact` 772, `memory.remember` (preference) 319, `memory.correct` **138** — against ~70 announced flips. Corrections happened; some targeted the wrong store.
- J.A.R.V.I.S.'s own diagnosis, day 10, unprompted: *"that graph result seems to be a mismatch from semantic search, so I'm relying on the preferences store."* It was right.
- Promotion: 5,990 decisions, 19 auto-escalations, all correct. Topic list at day 500: 6 designed + `orbital mechanics` (synonym) + **`tuning`** (activity word). During the 180-day dead-model window, the fallback promoted `remind, lunch, second, coffee, umbrella, looks`.
- Dup-tidy proposals at day 500 included *"'alloy_supplier_assigned_number' and 'preferred_alloy' look like the same thing"* — a false pair — alongside the correct `weekend_desk_plant`/`desk_plant` pair.

---

## 4. Defect A — Retrieval precision

### 4.1 Root cause (code)

`services/kernel/src/memory/entities.ts`, `recallGraph()` (~L1065):

```ts
if (this.semantic) { hits = semantic.search(query, {limit: limit*2}); ...seedIds from hits }
if (seedIds.size === 0) { /* lexical: entity names contained in the query */ }
```

The lexical branch is a *fallback*, gated on the vector search returning **zero** seeds. A live embedder always returns *something* — its nearest neighbours — so the lexical branch is dead code in production, and the graph is seeded by similarity rather than identity. `optics vendor two`'s question seeds `optics vendor` (a closer vector), and one-hop expansion never reaches the right entity. The dead-embedder run was better precisely because it was forced onto this branch.

Secondary: even the lexical branch has no specificity preference — `q.includes("optics vendor")` is true for a query about `optics vendor two`, so both seed with equal standing.

### 4.2 Design — lexical-first hybrid seeding

`recallGraph` becomes a three-stage seeder; `mode` reports which stages contributed.

1. **Identity seeds (always run).** Every active entity whose full name (or alias) is contained in the query, matched case-insensitively on word boundaries. Ranked by **name length descending** — the most specific match wins (`optics vendor two` before `optics vendor`). Guard against common-word names: a name qualifies only if it has ≥2 tokens **or** ≥5 characters.
2. **Similarity seeds (when an embedder is present).** The existing vector hits, in their existing order, **appended after** identity seeds, deduplicated.
3. **Cap** at `limit` seeds, as today. One-hop expansion unchanged.

Result shape gains `seeds: {name, via: "identity"|"similarity"}[]` so the agent (and the Command Center) can see *why* an entity appeared. `mode` becomes `"hybrid" | "semantic" | "lexical"`.

`memory.recall(name)` is unchanged (it is already exact) but its tool description is sharpened to *"by exact name"*, and `memory.recallGraph`'s to *"by name AND by meaning"*, so tool choice by the planning model is better informed.

### 4.3 What this does not change
No embedding, index, or schema change. Association-by-meaning is preserved for the queries that need it (the similarity stage still runs). No LLM in the read path.

### 4.4 Knob
`memory.recall.identityFirst` (boolean, default **true**), catalogued per D-0058/D-0053 — the off-switch restores today's behaviour for A/B, and is the lab-surface candidate if the Night Lab ever wants to experiment with it.

### 4.5 Acceptance (must all pass before merge)
- **Unit — neighbour precision.** Entities `optics vendor` and `optics vendor two`, each with one fact; a stubbed semantic layer that returns `optics vendor` first. Query *"what is optics vendor two's assigned number"* → seed[0] is `optics vendor two`, `via: "identity"`.
- **Unit — specificity.** Names `roof array`, `roof array two`, `roof array north`; query mentions `roof array north` → it seeds first; `roof array` seeds too but after.
- **Unit — common-word guard.** An entity named `kiln` (single short token) does not seed on a query that merely contains "kiln" inside another word; `weather mast` does.
- **Unit — offline parity.** With `semantic` undefined, results equal today's lexical branch plus the ranking rule.
- **Replay gate (§9):** retrieval-class misses that surface the value through the recall endpoints rise from the recorded baseline by **≥50% relative** (target ≥38 of 76).
- Kernel suite green, no skips (`make test`).

---

## 5. Defect B — Update coherence and batch write drops

### 5.1 Root cause (evidence)

Two shapes, both real:

- **Route mismatch on update (dominant).** At teach time the planning model decides where an attribute lives: some become entity facts (`memory.rememberFact`), some become preferences (`memory.remember`, e.g. `optics_vendor_two_assigned_number`). When the value later changes, `memory.correct` searches **entity facts only**. A preference-routed fact is invisible to it, so the update is either dropped or written as a *new* fact on a fresh entity — while the preference keeps the stale value the quiz then scores against. 11 of the 15 write-class facts had flip announcements.
- **Batch skip (rare).** Of a 2-statement teach (`tessa novak` — "based in Cusco; meets on Monday"), the second statement was never written. The gated `rememberFact` tool verified what it stored; the model simply did not issue the second call.

### 5.2 Design

**B1 — Route-agnostic correction.** `memory.correct` gains a resolution order:
1. `factId` (unchanged, D-0062 read-then-write contract);
2. entity-fact text match (unchanged);
3. **preference match**: a preference whose normalized key tokens ⊇ the subject's tokens (same normalizer as §7) → `MemoryService.correct(key, value)` (supersede-with-history, already exists).
The result reports `route: "fact" | "preference"`. It never writes to the *other* route, so a value has one home.

**B2 — Batch remember.** New gated tool `memory.rememberFacts({ entity, statements[] })`, LOW_REVERSIBLE (same class as `rememberFact`), one approval, each statement stored and **individually re-read** after write; returns per-item `{stored: bool, factId}`. A partial failure is reported per item, never masked. The agent runtime's tool guidance names it as the tool for "remember these N things". Removes the per-item skip by making N items one call.

**B3 — Update statements prefer correction.** `memory.rememberFact`'s description gains: *"If this replaces something already known, use memory.correct instead"* — and `correct`'s says *"Works for entity facts AND preferences."* Prompt-level, cheap, measurable in tool-call ratios.

### 5.3 Acceptance
- **Unit — pref-routed update.** Preference `optics_vendor_two_assigned_number = 24`; `memory.correct({ entity: "optics vendor two", replaces: "assigned number", value: "68" })` → preference now `68`, history row preserved, `route: "preference"`, **no** new entity fact created.
- **Unit — batch.** `rememberFacts(entity, [s1, s2, s3])` → 3 facts, each re-read; simulate a write failure on s2 → result marks s2 `stored:false`, s1/s3 stored, tool result `ok:false` with the per-item detail.
- **Integration — flip mini-life.** Teach 20 facts through the real agent (mixed routes), announce 10 flips through the agent, quiz → ≥19/20 return the *current* value. (Scratch DB, real model; ~$1.)
- Kernel suite green.

---

## 6. Defect C — Generic-term promotion

### 6.1 Root cause
`ReasoningTuner.recordCorrection` counts whatever terms the extractor returns. Two extractors:
- the **judge** (`judge-topic-extraction` template) — after the 2026-08-30 fix it rejects routine *questions*, but still returns the activity in a deep question (*"how would you approach tuning the …"* → `tuning`);
- the **deterministic fallback** `salientTerms` — used when the judge returns `null` (offline, gate off, provider dead). It keeps every ≥5-letter non-stopword. During the 180-day dead-model window it promoted six filler words. **The fallback learns worse than not learning.**

### 6.2 Design
**C1 — Template clause.** Append to `judge-topic-extraction`: *"Return the SUBJECT DOMAIN — a field, system, material, or phenomenon — never an activity, method, or process word ('tuning', 'planning', 'testing', 'setup', 'review'). If the only candidate is an activity word, return an empty list."* (Registry-seeded like the others; the Night Lab may experiment with it.)

**C2 — Fallback may accumulate, never promote.** Candidates gain a `judged` count alongside the raw count. Promotion requires `count ≥ 2` **and** `judged ≥ 1`. When the judge is unavailable, corrections still accumulate (nothing is lost) but no topic is promoted until a judge has confirmed the term at least once. The response says so honestly: *"noted — I'll learn that topic once my judgment model is available."* Learning by **instruction** (`reasoning.teachTopic`) is unaffected — the user saying it outright is its own confirmation.

**C3 — Retroactive hygiene (one-time, disclosed).** `tuning` is removed from the live topic list at deployment via the existing `DELETE /core/reasoning/topics/:topic` path, with a decision-log note. No automatic demotion is introduced (out of scope; a demotion proposal is a candidate for a later spec).

### 6.3 Acceptance
- **Unit — activity word.** Judge stub returns `["tuning"]` twice → C1 is a prompt change, so the *deterministic* guard is what's tested: with the judge stub returning `[]` for the activity phrasing, no promotion after 3 corrections.
- **Unit — fallback cannot promote.** Judge `null`; 5 corrections on *"should I take an umbrella if the sky looks grey"* → candidates accumulate, `topics()` stays empty, response carries the deferral notice.
- **Unit — judge-confirmed promotion still works.** Judge returns `["plasma containment"]` twice → promoted (unchanged behaviour).
- **Replay.** The six outage terms (`remind, lunch, second, coffee, umbrella, looks`) fed through `recordCorrection` with judge `null` → zero promotions.

---

## 7. Defect D — Preference dup-tidy over-fires

### 7.1 Root cause
`MemoryService.tidyDuplicates` normalizes keys to filler-stripped token sets and treats **subset-or-equal** as near-duplicate. `preferred_alloy` → `{alloy}` ⊆ `{alloy, supplier, assigned, number}`. Single-token keys match everything sharing the token.

### 7.2 Design
Two keys are near-duplicates only when: `|A ∩ B| ≥ 2` **and** `min(|A|, |B|) ≥ 2` **and** (`A ⊆ B` or `B ⊆ A`); or `|A| = |B| = 1` and `A = B` (exact single-token match, e.g. `colour` vs `colour` after filler strip). Everything else unchanged: same-value folds (pins never folded), differing values become proposals.

### 7.3 Acceptance
- `preferred_alloy` vs `alloy_supplier_assigned_number` → **no** proposal, no fold.
- `usual_coffee_order` vs `coffee_order`, same value → fold (existing test still passes).
- `weekend_desk_plant` vs `desk_plant`, different values → proposal (existing behaviour).
- Kernel suite green.

---

## 8. Proposed requirements

| ID | Requirement | Verified by |
|---|---|---|
| **R-MEM-07** | Entity recall seeds by **identity before similarity**: an entity whose name is contained in the query ranks ahead of vector neighbours, most-specific name first; works with no embedder | §4.5 unit + replay |
| **R-MEM-08** | A correction reaches the store where the fact **actually lives** (entity fact or preference) and supersedes with history; it never creates a second home for the value | §5.3 unit + mini-life |
| **R-MEM-09** | Multi-statement teaching is available as **one verified batch call** with per-item outcomes; partial failure is reported, never masked | §5.3 batch test |
| **R-MEM-10** | Learning-by-correction promotes a topic only on **judge-confirmed** extractions; without a judge the system accumulates but does not promote, and says so | §6.3 |

---

## 9. The replay instrument (Slice 0 — before any kernel change)

`scripts/longitude_replay.py`: for each of the 118 missed (day, fact, question, announced truth) records in the preserved run, query the **kernel's recall endpoints directly** — `memory.recallGraph`, `memory.recall`, `memory.recallPreferences` — against the day-500 database, and check whether the truth value appears in the returned detail. No LLM answer step; this isolates the retrieval layer from the answering model's tool choice.

Output: per-miss `{found_via: [...] | none}`, and the aggregate split *(present-and-surfaced / present-but-not-surfaced / absent)*. Run **before** Slice 1 to record the baseline (and to settle the true A/B split), then after each slice. Deterministic, seconds to run, zero API cost (embedding calls only).

---

## 10. Build plan (spec-driven; each slice: tests first, then code, then green suite, then commit)

| Slice | Scope | Gate |
|---|---|---|
| **S0** | Replay instrument + baseline numbers committed to the record | baseline recorded |
| **S1** | Defect A — identity-first seeding, `seeds[].via`, knob, tool descriptions | §4.5 all pass; replay ≥ +50% relative |
| **S2** | Defect D — dup-tidy guard | §7.3 |
| **S3** | Defect C — template clause, judged-count promotion, deferral notice, `tuning` removed | §6.3 |
| **S4** | Defect B — route-agnostic `correct`, `rememberFacts`, description nudges | §5.3 incl. the ~$1 mini-life |
| **S5** | Records: `docs/verification/RETRIEVAL_FIDELITY_<date>.md`, traceability rows R-MEM-07…10, decision log D-0080 → IMPLEMENTED, module CLAUDE.md | docs updated |
| **S6** | **Field verification — the second act.** Resume the preserved life at day 501 → 1000 with the relationship layer (already built, hash-verified). Attribute recall (existing metric) vs days 1–500 measures S1+S4; multi-hop recall (new metric) measures the relationship layer; zero-fabrication, D-0052, lab discipline must not regress | see §11 |

Estimated effort: S0 ½ day · S1 1 day · S2 ¼ day · S3 ½ day · S4 1 day · S5 ½ day · S6 ~8h wall, ~$70.

---

## 11. Verification plan — how we will know

**Before field:** every §4–7 acceptance test in the kernel suite; replay deltas recorded in the verification record with before/after numbers.

**Field (S6), pre-registered targets:**
- Attribute recall days 501–1000 vs days 1–500: **≥ +5 percentage points** (from 87.9%). Below +2 → the fixes did not move the number; write that down.
- Multi-hop recall (72 two-hop probes): first baseline, no target — report the number.
- **Zero fabrications** must hold. **D-0052** arc must be unchanged. **Lab** must keep discarding on evidence.
- Latency flat; `assert_model_live` and `assert_embeddings_live` never fire spuriously.

**Disclosure:** the second act is a *continuation* with two deliberate interventions (the fixes, the relationship layer) at day 501; the record says so. Days 1–500 remain the untouched baseline.

---

## 12. Risks

- **Over-seeding by identity** on very common entity names → mitigated by the ≥2-token/≥5-char guard and the `limit` cap; the knob allows instant rollback.
- **Route-agnostic `correct` updating the wrong preference** on ambiguous subjects → normalizer requires the subject's tokens to be a subset of the key's; ties refuse and report ambiguity rather than guess.
- **C2 slows learning offline** → intentional and disclosed; instruction-based teaching remains instant.
- **The replay instrument measures retrieval, not the agent** → that is the point; the field run measures the whole.

---

## 13. Open questions for the check-in

1. **Identity-first as default** (`memory.recall.identityFirst = true`)? The evidence says yes; the knob keeps the A/B possible.
2. Should **C3** (removing `tuning`) be automatic at deploy, or left for the user to delete from the memory panel? (Spec proposes automatic, logged.)
3. **Second-act budget**: ~$70 at the observed rate; confirm before S6 launch (the cost cap and the model-liveness guard are both armed).
4. Is a **demotion proposal** for never-firing learned topics wanted in this spec, or deferred? (Proposed: deferred; it needs per-topic promotion dates the store does not yet keep.)
