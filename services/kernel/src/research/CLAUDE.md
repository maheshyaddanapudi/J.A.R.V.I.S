# kernel/src/research — research-with-provenance (Phase 2, parity C3)

Turns the REAL web browser into a **research pipeline where every finding is
traceable to its source** — the spec's "research with per-claim provenance". No
unsourced claims: each passage carries `{url, title, line, snippet}`.

## Files
- `contract.ts` — `Researcher` interface + `ResearchFindings`/`Evidence`/
  `SourceStatus`. `checkTargets` policy-checks URLs without fetching (for a tool's
  disclosure).
- `gather.ts` — `WebResearcher(web)`: for each source, applies the web network
  policy (`checkTarget`), opens it (real Chromium), extracts the query-relevant
  passages (scored by distinct query terms matched), and tags each with its
  source. A refused/failed source is **recorded, never fabricated**. Evidence is
  returned most-relevant first.
- `tools.ts` — `research.gather(query, urls[])`: ONE CONSEQUENTIAL action that
  discloses ALL target URLs upfront (any out-of-policy URL → clean pre-approval
  denial), then gathers. The sourced evidence is fed to the agent as `detail`
  (D-0033) so it can synthesize an answer **that cites its sources**.

## Composition / gating
Research composes the (gated) web browser: the single `research.gather` approval
covers the whole set of disclosed sources, and the per-URL network policy still
applies inside `gather` (offline refuses external, `file://`/`data:` refused).
This keeps the "outbound only to explicitly-configured sources" contract — the
user sees and approves the exact source list.

## Verified (2026-07-17)
- 6 tests (`test/research.test.ts`): `checkTargets` policy; multi-source gather
  with real Chromium over a local server — every passage tagged with a real source
  URL/title, relevance ranking (toxicity passage outranks an irrelevant weather
  line), a refused `file://` source recorded (not fabricated); gated loop
  (approved → cited evidence in `detail`; denied → no fetch; out-of-policy source
  → clean pre-approval denial). Full suite **176 pass**.
- Live: approved `research.gather` over two local pages returned 4 ranked passages,
  **each citing its exact source URL + line**; an out-of-scope `file://` source
  cleanly denied the whole gather. Harness row **P-RESEARCH-01**.

## Next
A per-source untrusted-content envelope for the agent (treat page text as data,
not instructions); a citation-checking pass; local-corpus sources (over the files
capability) alongside web sources.
