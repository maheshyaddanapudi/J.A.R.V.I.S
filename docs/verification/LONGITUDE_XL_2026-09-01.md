# Longitude-XL — 500 simulated days at scale (2026-09-01)

**Question:** the 100-day run (`LONGITUDE_2026-08-30.md`) showed the evolution
framework works *correctly*. This asks whether it holds at **scale** — hundreds
of topics, thousands of conversations, memory crowding, and 500 days of aging.

**Verdict: recall does not decay.** 87.9% across 50 quiz batteries, with a
measured trend of **+0.43 points per 100 simulated days** — flat-to-slightly-up
while the store grew ~10×. The run also earned the first Night Lab **keep** at
longitude, and produced two findings that redirect the fix queue.

Continuable: the world is seeded to a 1000-day horizon and the snapshot in
`docs/verification/longitude_xl/` restores to day 500 for a second act.

---

## 1. Method

One continuously-running kernel on `jarvis_xl`, never reseeded, 500 simulated
days. Real Anthropic models (**Haiku 4.5** conversation, **Sonnet 5**
planning/deep) and a **real local 768-dim embedder** (all-mpnet-base-v2). The
world: **178 topics / 353 facts**, seeded and hash-pinned (`9206ceb12fd98ad6`)
— 28 routed through preferences, 109 with scheduled truth-flips, attention
cadences from weekly to fading. ~10 conversations/day (~5,000 total).

Nightly the whole database is aged one day (except `audit_log`,
`schema_migrations`, `reasoning_decisions`) so age-dependent logic sees real
age. Quiz batteries every 10 days ask ~20 facts stratified by route, flip
count and age, scored per-fact against the announced truth, **raw answers
preserved**. Lab nights every 20 days; kernel restarts at 100/300/500; quiet
stretches at 200-215 and 450-465.

## 2. Headline: no decay under crowding

| Window | Recall |
|---|---|
| first 10 batteries | 87.6% |
| middle 10 | 89.0% |
| last 10 | 87.5% |
| **overall** | **860/978 = 87.9%** |

Linear fit: **+0.43 pp per 100 days**. Individual batteries reached 20/20 as
late as day 450. Meanwhile the brain grew to **128 entities, 250 active facts
(+51 superseded), 95 preferences, 723 episodes, 1,129 vectors, 14,513 audit
entries** — and **latency was flat**: 2430ms over the first 50 days, 2405ms
over the last 50.

Retrieval cost was measured directly rather than inferred: vector search 1.8ms,
preference lookup 0.25ms, episode recall 0.16ms, context assembly 7-8ms, full
audit-chain verify 40-50ms — against 1,347-3,839ms per model call. Local work
is ~0.5% of a turn. Separately, on a scratch copy loaded to **5,060 entities /
25,043 relations**, depth-3 traversal from a 407-edge hub reaching 1,151 nodes
cost **20ms** — the graph path has headroom for a decade.

## 3. What the failures actually are

Of 978 scored facts, **118 misses (12.1%)**, classified by checking whether the
value exists in memory *under that topic*:

| Class | Count | Share of misses |
|---|---|---|
| **Retrieval** — value present, not found | 76 | 64% |
| **Write** — value never landed | 42 | 36% |
| (of all misses, said "not found" explicitly) | 91 | 77% |

**Zero fabrications.** No answer invented a value that never existed in the
world; wrong answers were always a real value — a neighbouring entity's, or the
fact's own earlier one.

Retrieval dominating is corroborated by an accidental controlled experiment
(§6): **the lexical fallback outscored semantic recall, 96.2% vs 85.9%**, on
identical worlds and days. Vector similarity returns *neighbours* —
`optics vendor` for `optics vendor two` — where exact-entity questions need
precision. J.A.R.V.I.S. diagnosed this itself, unprompted, on day 10:

> *"'optics vendor two' appears in memory associated with … the 'greenhouse
> automation' project entity — that graph result seems to be a mismatch from
> semantic search, so i'm relying on the preferences store."*

It then answered all four questions correctly.

## 4. Evolution mechanisms at scale

- **Learned routing, surgical across 5,990 decisions:** 4,993 routine→fast,
  967 user-forced deep, 10 correction-promotions, and **19 automatic
  escalations — every one on a genuinely learned topic**, zero false positives.
- **D-0052 pin/override, metronomic:** across five independent runs the arc was
  identical — pin day 5 → override at exactly 6/6 → re-pin (bar ×2) → override
  at exactly 12/12 → re-pin (bar 24). Every override announced with
  `changedUserSetting: true`.
- **Supersession with history:** 51 of 301 fact rows carry `superseded_by`
  chains; flips were tracked, not overwritten. The day-87 flip that looked like
  a stale-value bug in an earlier run resolved correctly here (68→**42**),
  and the trace showed the earlier case was a *first-teach write miss*, not
  memory corruption — **supersession exonerated**.
- **Preference recall survives disuse:** day 210, mid-quiet-stretch, preference
  facts scored **5/5** — the exact condition under which the 100-day run watched
  recall fade before `memory.recallPreferences` existed.
- **Night Lab earned a keep:** **29 discards, 1 keep** over 30 nights. The keep
  cleared the bar honestly — mean persona **93.0 ≥ baseline 88.4 + δ4** across
  3 trials, on a candidate that deliberately isolated one hypothesis. A bar
  that yields ~3% keeps over 30 attempts is doing its job.
- **Restart continuity:** three restarts (days 100/300/500), quizzes on both
  sides each time, no loss. Audit chain intact end-to-end: 14,513 entries.

## 5. Open defects (fix queue)

1. **Retrieval precision** — 64% of misses. Exact-entity lookup should try
   lexical/name matching **first** and use vectors for association, reversing
   today's order. Two independent lines of evidence agree.
2. **First-teach write drops** — 36% of misses; a taught fact silently fails to
   land. Needs a read-back verify on the teach path.
3. **Over-promotion, generic terms** — `tuning` was promoted from a legitimately
   deep question, but the term is generic enough to escalate anything. The
   routine-question gate added after the 100-day run works; a *generic-term*
   gate is still missing. (Never fired in 500 days — latent, not active.)
4. **Preference dup-tidy over-fires** on single-token keys (`preferred_alloy`
   normalises to `alloy`, a subset of everything containing "alloy"). Proposals
   only, never destructive. Needs a minimum-token-overlap guard.
5. **Graph coverage gap** — attributes were taught, never *relationships*, so
   `memory_relations` stayed at 0 and multi-hop recall was never exercised
   behaviourally. The relationship layer for days 501-1000 is built and pushed
   (96 edges, 72 two-hop probes, catalog hash unchanged).

## 6. Incidents — instrument, not system

Three harness failures, all disclosed, none affecting the kernel:

1. **Dead embedder (141 days).** A container idle-freeze killed the embed
   server; nothing checked, so the run measured the *lexical fallback* for 141
   days. Aborted and rerun. Silver lining: an accidental controlled experiment
   (§3) on identical worlds. Fixes: `ensure_embedder()` self-heal +
   `assert_embeddings_live()` halt on flat vector counts. **The kernel behaved
   correctly throughout** — honest degradation, failures logged, no fabrication.
2. **Credit exhaustion at ~day 315.** The API balance hit zero; the run
   continued 180 days scoring 0/20 on every battery. The $250 *cost cap* could
   not see it — **a spend counter measures what was used, not what remains**.
   Fix: `assert_model_live()` halts when the last 20+ calls all failed, quoting
   the provider's error, checked every quiz day. Damage repaired before resuming
   — world un-aged by the 190 dead shifts, the 6 junk topics the heuristic
   fallback promoted while the judge was dead removed via the kernel's own
   delete path, checkpoint rebuilt to day 311 by deterministic replay. Void rows
   archived as `*.with-void-period.*`; the audit log keeps its honest record of
   4,366 failures.
3. **The repair broke the new guard.** Un-aging by +190 days pushed those 4,366
   historical failures to a timestamp *five months ahead of now()*, so
   `ORDER BY at` read them as "the latest calls" — 39 failures to 1 success,
   one row from halting a healthy run. **In a database where time is
   deliberately manipulated, no query may trust the timestamp**; the guard now
   orders by insertion `id`, the only monotonic clock left. Caught by noticing
   the failure count contradicted visible progress.

A fourth, earlier: the quiz scorer once marked a *perfect* answer 0/4 because a
preamble sentence ("…for items 1 and 3.") matched its whitespace-anchored
segment split. Segments are now parsed line-anchored and keyed by their own
number.

## 7. Verdict

At 5× the horizon and 10× the density of the 100-day run, the **trust layer
held exactly**: every override at its exact bar, supersession with history,
staleness proposed-never-forgotten, 29/30 lab nights discarded and the one keep
earned on evidence, audit intact across three restarts, and **not one fabricated
answer in 978 scored recalls**. The **learned layer** produced durable, precise
behaviour change — 19 auto-escalations, all correct, across 5,990 decisions.

What degrades is not memory but **retrieval precision**, and the run localised
it well enough to act on: prefer exact matching for exact questions, keep
vectors for association.

**Cost:** $70.09, ~7.7h wall, ~5,000 conversations, 12,505 successful model
calls.

**Artifacts:** `docs/verification/longitude_xl/` — full DB snapshot (restore
verified: row counts intact, all fact statements still `v1.gcm` ciphertext),
checkpoint, 50 batteries of per-fact records with raw answers, run log, and
restore/continue instructions.
