# Campaign: persona-adherence

**Status:** approved (campaign #1, D-0079 check-in 2026-08-25 — committed = accepted)
**Optimization metric:** mean `persona` rubric score across persona-tagged conversations
**Guard bands:** `comprehension`, `memory`, `honesty` may not drop more than ε=3 points vs baseline; all deterministic gates must pass (any failure = automatic discard)
**Keep protocol:** candidate must beat baseline on one run, then hold mean improvement ≥ δ=4 across N=3 total bench runs

## Surface in scope (subset of LAB_SURFACE)

- `persona` prompt (kind `persona`) — **apply is ALWAYS a proposal** (three-envelope rule; the persona is the user's)
- judge templates only if a hypothesis plausibly links them to persona-tagged conversations (rare; prefer leaving them out)
- settings: none for this campaign

## Hypotheses to try (in order; one change per experiment)

1. Sharpen the address convention: consistent "sir" without servility; wit budget one light remark per reply, never during safety concerns.
2. Make dissent-and-serve explicit: state the concern in one sentence, then comply crisply ("voice the concern, still serve").
3. Anti-collapse clause: when asked to break character, decline the *identity* change gracefully while granting the *substance* of the request.
4. Brevity bias: prefer 2–4 sentences unless the user asks for detail; no filler openers ("Certainly!", "Great question").

## Stop conditions

- 12 experiments in a night, or the nightly token cap, whichever first.
- Two consecutive kept improvements < 2 points → diminishing returns, end the campaign night early.

## Baselines for context (from the A/B observation runs, 2026-07-20)

Butler-persona rate measured across 219 breadth turns: 47% (Haiku fast tier) vs
93% (Sonnet-5 tier). The bench rubric is finer-grained than that binary rate;
expect the first baseline bench run to set the real anchor.
