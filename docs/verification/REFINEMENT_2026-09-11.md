# Longitude-XL refinement pass — closing every ledger row (2026-09-11 →)

**Scope.** After the 1000-day run, every observation in
`LONGITUDE_XL_GAP_LEDGER.md` (G-01…G-17, E-01…E-07) is researched from
primary evidence, analysed, fixed where a fix exists, retested, and moved to a
terminal status: FIXED+VERIFIED, PREVENTED, ACCEPTED (with the reason), or
DESIGNED-INTO-ACT-3. Nothing leaves the ledger without one of those. Each
slice below follows the D-0080 treatment — tests from the captured tool
arguments, code, the full `make test` with no skips, a Sonnet-5 manual check
through the real agent — and the third act is the field retest on one build.

Kernel builds used for manual checks: the D-0080 verification kernel on port
4170 over the scratch `jarvis_fidelity` database (all roles on Sonnet 5), and
read-only questions to the preserved `jarvis_xl` day-1000 world on port 4160
(zero writes, verified from the audit log after each probe).

---

## R1 — strict re-score (G-13) → CLOSED

Record `LONGITUDE_XL_RESCORE_2026-09-11.md`. First act 87.9 % → 82.4 %,
second act 93.0 % → 90.4 % (+8.0 pp), old world 91.3 % → 87.7 % (+5.3 pp),
chapter two 97.5 % unchanged, two-hop 89.8 % → 63.9 %. Two findings fed the
ledger: three of four nicknames collide (G-12 widened) and the entity
resolver merged distinct twins as aliases (new G-17, root cause of the twin
family). The strict scorer is the third act's scorer.

## R2 — first-person preferences written as entity facts (G-05, G-06) → FIXED+VERIFIED

**Research.** Audit trace of the three chapter-two misses: "my study plant is
basil" → `memory.rememberFact` on a new thing `study plant` (seq 19131–19135);
"my bike colour is olive" → thing `bike` (seq 17594–17598); "my gym day is
friday" → entity `user`. Each was recalled whenever the agent consulted the
graph and reported "not found" whenever it consulted only
`memory.recallPreferences`. All seven chapter-two misses were these three
facts.

**Fix (kernel).**
- Write side, `entityTools.ts` `preferenceInDisguise()`: a first-person
  "my X is Y" whose entity is X itself (token containment either way) or the
  user (`user`/`me`/`myself`/`owner`/`the user`) is refused by
  `memory.rememberFact` and per item by `memory.rememberFacts`, with the exact
  preference write handed back (`memory.remember`, key `study_plant`, value
  `basil`). A first-person statement about someone else ("my sister is Anna"
  on entity Anna) passes. The tool description now says a first-person
  statement is a preference.
- Read side, `core/tools/recallPreferences.ts`: given the entity memory, a
  filtered recall also reports facts held on the thing named by the query
  (whole subject, then each content word), and on the user's own entity,
  labelled "held as ENTITY facts" so the agent knows where they live. Bounded
  to five, sensitive facts withheld, unchanged without an entity memory.

**Tests.** 7 new tests in `test/retrieval_fidelity.test.ts` from the three
captured objectives (refusal with the handed-back key/value; `user`/`me`/`the
user`; head-noun entity `bike`; third-person passes; batch refuses per item;
legacy tool unchanged; read fallback finds `bike` and `user` facts and skips
unrelated ones). Full suite **495/495, 0 skipped**.

**Manual check, Sonnet 5 (port 4170).** "Remember these things: my study
plant is basil." / "…my bike colour is olive." / "…my gym day is friday." — the
agent chose `memory.remember` directly for all three (the description nudge
was enough; the refusal did not need to fire) and the stratified quiz answered
basil / olive / Friday from `recallPreferences`.

**Manual check, preserved day-1000 world (port 4160, read-only).** The same
quiz against the world that holds the misfiled facts: `recallPreferences`
reported "0 preference(s) matching 'bike' + 1 entity fact(s)" and "… 'gym' + 1
entity fact(s)"; the agent answered study plant basil, bike colour olive, gym
day Thursday (the announced truth at day 1000), desk plant monstera. Zero
writes to `jarvis_xl` (audit verified).

**Status.** G-05 FIXED+VERIFIED; G-06 already resolved into G-05. The
existing three misfiled facts stay where they are in the world (the read
fallback now finds them); chapter three re-asks them as part of the G-01
re-teach check.
