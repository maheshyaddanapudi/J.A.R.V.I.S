# R15 verification — act three's misses re-asked against the repaired world

Run 2026-09-15. All **70** act-three strict misses re-asked through the real agent
against the repaired 1500-day world (`scripts/longitude_xl_refix_verify.py`),
scored with the same `StrictScorer` the act used. Asking only — nothing taught.

## What the instrument can and cannot tell you (read first)

It reliably identifies a **FIX**: a hit is a hit, scored by the act's own rubric.

It CANNOT reliably identify a remaining failure, and its "still wrong" bucket is
**not reported as a finding** here. Two flaws, both found before publishing:

1. **Stale truths.** The world's values FLIP over time. A miss recorded on day
   1040 carries the truth *as of that day*; the store may since hold a different,
   legitimately newer value. **12 of the 39** so-called "still wrong" rows are on
   flipping facts — e.g. `desk plant`, truth-then `monstera`, answer-now `basil`
   cited from both the entity and the stored preference, which is consistent with
   a later flip and is very likely a CORRECT answer scored wrong.
2. **The absent detector keyed on the literal string "not found"**, so an honest
   `"alloy supplier: no facts recorded"` was bucketed as wrong.

A clean read of the remaining misses needs truth as-of-now, which is exactly what
a running act provides and a post-hoc replay does not.

## What it does establish

| bucket | n | by kind |
|---|---|---|
| **FIXED** | **18** | **alias 7, base 8, hop 3** |
| ABSENT (genuinely not stored) | 13 | retired 9, base 4 |
| not measurable (see caveats) | 39 | base 24, hop 15 |

- **T5 is genuinely fixed: 7 of 7 alias misses now answer correctly.** These are
  the real questions the act failed — `"What is the ravi's meets on?"` missed six
  times across days 1010–1330 — answered right on the repaired build. G-32 was the
  cause and the fix reaches it.
- **T6's nine retirement misses are all ABSENT**, confirming the ledger's reading:
  one entity (`fusion sim north`) whose closure the OLD build superseded away, with
  no active fact to answer from. Not a defect on this build (pinned by a regression
  test) — a **re-teach item**, and it is seeded into chapter four's re-teach set.
- **4 base facts are likewise absent** from every store — also re-teach items.

## One residual, recorded rather than resolved

`air scrubber` holds `located_in → Lakeside Cabin North` while a plain
`lakeside cabin` also exists. Whether that edge was legitimately updated to the
twin during the act or is a twin substitution written into the graph cannot be
settled from the catalog, which carries only `maintains` edges for that thing.
Left open deliberately: **chapter four measures two-hop on FRESH chains**, where
the truth is unambiguous and the question is answerable.
