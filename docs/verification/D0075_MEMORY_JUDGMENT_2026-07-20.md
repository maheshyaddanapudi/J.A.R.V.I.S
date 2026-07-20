# D-0075 verification — fast-model memory judgments + self-authored/reusable skills

**Date:** 2026-07-20 · **Brain:** real Anthropic (Haiku `fast_conversation` / Sonnet-5
`deep_reasoning`) · fresh `jarvis_d75` DB. Closes the four open bugs from
`OBSERVATION_RUN_2026-07-19.md` and the two user asks (author MD skills; make
self-built skills/code reusable).

## What changed
- `src/memory/judge.ts` — `MemoryJudge` / `GatewayMemoryJudge`: three fast-model
  judgments (entity resolution, fact-merge, deep-topic extraction), each
  **best-effort with a deterministic fallback** (null on any failure → caller uses
  the old code path), privacy-class-aware, gated by `memory.llmJudgment` (default on).
- `src/memory/entities.ts` — `rememberEntity` now (1) resolves name-variants to a
  canonical entity via the judge + records the variant as an ALIAS (migration
  0025 `aliases text[]`), (2) takes a `pg_advisory_xact_lock` on the canonical
  (name, kind) so parallel same-name writes serialize (bug 5), (3) keeps the
  fact-migration-forward fix. `consolidate()` asks the judge which facts restate
  each other, falling back to the jaccard/stem heuristic. `findEntity` is
  alias-aware.
- `src/core/reasoning.ts` — `ReasoningTuner.recordCorrection` extracts the deep
  topic via the judge (fallback to `salientTerms`). `assessDepth` unchanged
  (stays deterministic + zero-latency).
- `src/skills/tools.ts` — `skill.save` / `skill.list` / `skill.run` (self-author,
  discover, reuse); `SkillRegistry.create({createdBy})` + `getByName`.
- `src/settings/catalog.ts` — `memory.llmJudgment` (boolean, default true).

## Automated tests — 376 pass (was 357; +19)
- `test/judge.test.ts` (9): parse (code fences), reject hallucinated candidate,
  index validation, filler-strip, best-effort null on error/unparseable, gate-off
  null, privacy mapping.
- `test/entities.test.ts` (+4): name-variant resolves to one entity + alias +
  recall by both; consolidate honors the judge's merge (below-heuristic facts);
  deterministic fallback when no judge; advisory-lock serializes 6 parallel writes
  to ONE active row.
- `test/reasoning.test.ts` (+2): judge-extracted topic used (no filler); heuristic
  fallback on null.
- `test/skills.test.ts` (+4): skill.save authors (audited as `jarvis`) + skill.list
  discovers; skill.run reuses via the agent; recursion guard; risk classes.

## Live real-brain verification (all judgments served by the fast model)
1. **Entity resolution (bug 2).** Remembered `Pepper Potts` + a fact; a later
   `Pepper` mention resolved to the SAME person — **one** active `person` entity,
   alias `{pepper}`, recall by BOTH names returns 2 facts. Survived a kernel
   restart. `/gateway/calls`: `memory-entity-resolution → claude-haiku-4-5 ok`.
2. **Fact-merge consolidation (dim 5).** Two restatements on `Reactor`
   ("runs on a palladium core" / "core is powered by the palladium element",
   jaccard ~0.5, BELOW the 0.7 heuristic) → `duplicatesMerged: 1` (2 facts → 1).
   `/gateway/calls`: `memory-fact-consolidation → claude-haiku-4-5 ok`.
3. **Deep-topic extraction (bug 4).** Two filler-heavy corrections ("Quick
   one-line intuition about palladium…") forced deep → learned topics went
   `[]` → `['palladium']` — no `quick`/`one-line`/`intuition`. Two
   `reasoning-topic-extraction → claude-haiku-4-5 ok` calls.
4. **Skills self-author + reuse (asks 1 & 2).** `skill.save` authored
   "status check" (audit actor `jarvis`); `skill.list` discovered it; `skill.run`
   (STANDARD) reused it end-to-end through the gated agent → real `system.info`
   → a synthesized status report. Code capabilities were already reusable
   (`capability:<name>` + `selfext.listActive`).
5. **Concurrency (bug 5).** Advisory lock unit-tested: 6 concurrent
   `rememberEntity("arc reactor")` → exactly 1 active row.

## Honesty notes
- The judge is **advisory**: every merge supersedes-with-history (reversible,
  walkable), nothing is hard-deleted on a model's word. Wrong merges are
  recoverable.
- **Offline/local-first preserved:** private/secret memory → LOCAL_ONLY (a
  remote-only fast model then yields the deterministic fallback, never an outbound
  call). `memory.llmJudgment=false` disables the model path entirely. The
  `memory-*` embed FAIL lines in `/gateway/calls` are the best-effort semantic
  index (no local embedder in-container) — they never block a write.
- Canonical-name choice on resolution is first-seen; the fuller name is reachable
  as an alias. Recall by either name works, which is what "remembers everything"
  requires.

## Open / deferred (honest)
- Entity-resolution canonical selection is first-seen, not "prefer the fuller
  name" — cosmetic; recall is unaffected.
- The advisory lock keys on the canonical name; a variant→canonical race with a
  concurrent write to the canonical's exact name is theoretically possible but
  single-user use is sequential.

Key was env-only and scrubbed (0 hits in repo + scratchpad); scratch DB dropped.
