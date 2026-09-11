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

## R3 — the twin family (G-02, G-04, G-16) and its root cause G-17 → FIXED+VERIFIED, with an honest residue

**Research.** The strict re-score traced every "answered from the sibling"
miss to the entity table: 29 of the 179 active entities carried an alias that
was a separately-taught *twin* — `Coral Census Two {coral census}`,
`Microscope Two {microscope}`, `kiln north {kiln, the kiln}`, `seed vault
{seed bank}`, `sensor importer north {sensor importer two}`. The audit trail
(`entity_remembered.resolvedFrom`) shows each merge happened when the twin was
first taught: the D-0075 judge compared the new mention with the existing
sibling and said SAME — its template's own model case of SAME was "a short
name vs its full name ('Pepper' ⇄ 'Pepper Potts')", exactly the shape of
`coral census` ⇄ `coral census two`. From then on every exact lookup of the
short name resolved to the sibling by design, so the sibling's values were
stated with full confidence (wrong values, never honest misses), and two-hop
chains and retirement lookups walked the sibling. Nothing announced it.

Two further defects surfaced on the way:
- **G-15's real cause.** `PromptRegistry.set()` deactivated *every* prompt of
  the same kind — right for the single persona, wrong for the five named judge
  templates. Each boot found four of them inactive, re-seeded them as fresh
  version-1 rows (79 rows in the day-1000 world), and only the last-seeded
  template was ever served from the registry; the rest fell back to the code
  constants. Registry edits to four of five templates never reached the model.
- **Facts are written without their subject.** The agent stores "Status colour
  is teal" on the entity, not "the coral census's status colour is teal". Once
  a twin has been folded in, nothing in the store says which sibling a fact
  belonged to.

**Fix (kernel).**
- `qualifierTwin()` — same base words, different qualifier (`two`, `north`,
  `2`, `new`, …) — is a rule, not a judgment: the resolver never offers a twin
  to the judge as a candidate, declines on the record if one is affirmed
  (`entity_resolution_declined`), never treats a twin alias left behind by an
  old merge as a hit (write side) or as a lookup match (`findEntity`, identity
  seeding), and the miss message names the twins that do exist as DIFFERENT
  entities. An article variant (`kiln` ⇄ `the kiln`) is the same thing and
  resolves either way.
- Every judge merge is now its own audited event (`entity_alias_merged`) and
  an announcement — "I've treated X as another name for Y (reason); if they are
  different things, tell me and I'll split them" — through the announcer.
- `splitTwinAliases()` (`POST /memory/reconcile-twins`, dry-run by default)
  gives a folded twin its own entity again: facts whose statement names it (and
  not the canonical) move with it, relations move when the audit trail names
  it, article variants split as one entity, the twin's original kind and casing
  are recovered from its superseded row, every split audited
  (`entity_alias_split`) and announced, nothing deleted. Twins with nothing
  attributable are reported as `unsplit`, never guessed.
- The judge template now says qualifier siblings and different head nouns are
  different things unless the facts prove otherwise; `seedJudgeTemplates`
  re-seeds a row it wrote itself when the built-in text changes (never a user
  or lab edit); `PromptRegistry.set()`/`activate()` keep one active row per
  NAME for templates and system prompts (persona keeps one per kind).
- Graph-recall output tags entities: "(named in your query)", "(similar — a
  DIFFERENT entity from 'X')", "(connected — a DIFFERENT entity from 'X')",
  prints "no connections recorded for X" when a named entity has none, and
  closes with "answer only about X; say not found rather than substituting a
  look-alike". The agent's system prompt carries the same rule.

**Tests.** 12 new (`entities.test.ts`, `judge.test.ts`, `prompts.test.ts`,
`retrieval_fidelity.test.ts`): the twin rule; a SAME-happy judge never sees
the twin and both entities survive with no alias; Pepper → Pepper Potts still
merges and is audited + announced; a leftover twin alias no longer resolves;
split dry-run/apply with facts, relations, kind recovery, article-variant
grouping, `unsplit` reporting, audit + announcement, idempotence; article
variants resolve both ways; miss wording; look-alike tagging; template re-seed
rules; templates coexist. Full suite **507/507, 0 skipped**.

**Reconciliation of the day-1000 world (applied, audited, announced; safety
dump `/tmp/longitude_xl/jarvis_xl.day1000-pre-reconcile.sql.gz`).** 10 splits
— `3d printer`, `cloud recycler`, `drone survey` (2 facts), `roof array` (3),
`roof array two`, `cold cellar` (1 relation), `kiln`, `quinn lindholm`
(a person who had been folded into "quinn lindholm's meets"), `seed bank`
(1 fact + 1 relation), `the cloud recycler` — 10 `entity_alias_split` events,
10 announcements, 189 active entities after. **9 twins could not be split**
(`aquarium rig`, `catering service`, `coral census`, `lakeside cabin`, `lena
moreau`, `microscope`, `glacier telemetry`, `sensor importer two`, `the
morning swim`): their facts carry no subject and their relations were recorded
under the merged name, so the store holds no evidence of which sibling owned
what. They are reported as `unsplit` and become chapter three's re-teach set
— the honest path, since a user who saw the (now existing) announcement would
have re-stated them. A first apply had created `the kiln` with itself as an
alias (the superseded row's article form was chosen); the bare form is now
preferred and a self-alias is pruned on the next run (`entity_alias_pruned`).

**Manual check, Sonnet 5 (port 4170), fresh twin family `field pump` /
`field pump two` / `field pump north`.** Three distinct entities, no aliases
(the earlier `tide gauge two` had been merged into a pre-existing `tidal gauge
two` as a spelling variant — a judgment call, and now announced). Single-hop:
field pump teal, field pump two ochre, field pump south "not found — a field
pump north is known separately, a different device". Retirement: field pump
"no longer active"; field pump two "not found — no status recorded" (correct:
distinct). Two-hop: `field pump north — rosa castillo` → "not found, rosa
maintains field pump two, not north"; `field pump two` → boat house;
**`field pump` (bare name) → the agent still leads with "rosa maintains field
pump two … (the plain field pump is a different, decommissioned entity with no
location link to her)"** — it now distinguishes the entities but states the
sibling's chain first. That is model behaviour on top of an honest tool
output; it is recorded as the residue of G-04 and measured by the strict
scorer in the third act rather than papered over.

**Manual check, reconciled day-1000 world (read-only, 0 writes).** `coral
census` status colour → "not found — Coral Census Two and coral census north
exist but are different entities" (was 5/5 the twin's value); `roof array`
home city → Tallinn (split fact); `seed bank` service day → Wednesday (split);
`kiln` home city → Lisbon (article variant); `roof array — priya silva` two-hop
→ "not found (the maintained array is Rooftop Garden Two, a different entity)";
"is the kiln still active?" → "not found" (the retirement fact was not
attributable — re-teach).

**Status.** G-17 FIXED+VERIFIED (resolver rule, audit + announcement, split
tool; 9 unsplit twins → re-teach in act three). G-02 FIXED+VERIFIED (a twin
alias never answers for the short name; misses name the siblings as
different). G-16 FIXED (article-variant lookup + split; the kiln's own
retirement fact awaits re-teach). G-15 FIXED (one active per template name;
re-seed of built-ins). G-04 FIXED on the kernel side with a recorded
model-behaviour residue — bare-name two-hop questions can still lead with the
sibling's chain — to be measured in act three under the strict scorer.

## R4 — two homes for one attribute (G-03) → FIXED+VERIFIED

**Research.** The day-1000 world showed three shapes of "two homes": two
active facts on one slot (`Microscope Two`: "Status colour is ochre" beside an
older "slate"); a fact beside a preference (`weather_mast_two_assigned_number
= 7` beside "assigned number is 3"; `lab-glass supplier two assigned number =
68` beside "…is 3"; `tidal_model_two_service_day = Thursday` beside "Service
day is Wednesday"); and a fact beside the entity's free-text **attributes**
written at first mention and never corrected (`Microscope Two` attributes
"status colour: cobalt", `Umar Brandt` "Based in Osaka" beside "based in
Bergen"). The agent then hedged ("conflicting values found — cannot confirm")
or answered the stale one: 45 hedges + 52 misattributed answers under the
strict rubric across the two acts, ~40 of the second act's 89 old-world
misses. `memory.correct` supersedes facts and preferences but never touched
attributes, and nothing ever compared the three stores.

**Fix (kernel).** `EntityMemory.reconcileHomes({ apply, prefs })`: for every
active entity, the slot/value of each fact (`parseSlot` — "Status colour is
ochre (changed from slate)." → `status colour = ochre`, "Umar Brandt is based
in Bergen" → `based in = bergen`, "home city: cusco"), of each attribute
clause, and of each preference whose key covers the entity (`matchKeys`, slot
= key tokens minus the subject) are grouped by slot; where two homes disagree,
the **newer** record wins and the older is retired **with history** — a fact
is superseded (`fact_superseded_by_reconciliation`), a preference soft-deleted
(`preference_superseded_by_reconciliation`), an attribute clause removed with
before/after in the audit (`entity_attributes_reconciled`). Agreeing
duplicates are not conflicts; private/secret records are never touched;
dry-run by default; one announcement per run summarises what was kept and
retired. Wired into the quiet-hours sleep cycle (`SleepCycle` → after the
duplicate-fact merge and preference tidy; findings/notes in the morning
report, `memory.homesReconciled`) and exposed as `POST /memory/reconcile-homes`.

**Tests.** `test/reconcile_homes.test.ts` (5): `parseSlot` on the shapes the
agent actually wrote; fact-vs-fact newer wins + history + idempotence;
fact-vs-preference in both directions (preference soft-deleted with the row
kept / fact superseded); attributes-vs-fact clause removal with before/after
audited; private facts untouched + agreeing homes not conflicts. Full suite
**512/512, 0 skipped**.

**Manual check, Sonnet 5 (scratch day-500 world, port 4170).** Before:
"lab-glass supplier two's assigned number — conflicting records, entity memory
says 42 but preferences…". Applied 26 reconciliations on the scratch world.
After: "42 / 3 / Tallinn" — clean answers to the same three questions.

**Applied to the day-1000 world (audited, announced; safety dump from R3
still valid — reconciliation deletes nothing).** Dry-run listed 12 conflicts,
each inspected: 7 stale preferences retired in favour of newer facts (weather
mast two 7→3, lab-glass supplier two 68→3, tidal model two Thursday→Wednesday,
battery retrofit two, morning swim two, irrigation controller, a sentence-valued
`priya_petrov_meeting_day`), 1 stale fact retired in favour of a newer
preference (rope: cedar→basalt fiber), 4 stale attribute clauses removed
(Microscope Two cobalt, 3D Printer Two bergen, greenhouse automation north
tallinn, Umar Brandt osaka). Idempotent afterwards (0). Read-only re-ask of the
previously hedged questions: microscope two **ochre**, lab-glass supplier two
**3**, umar brandt **Bergen**, weather mast two **3**, tidal model two
**Wednesday** — all stated cleanly, 0 writes.

**Status.** G-03 FIXED+VERIFIED. The nightly pass keeps the world at one home
per attribute from now on; the third act measures whether hedges disappear
from the strict-scored batteries.

## R5 — relations without supersession (G-07) → FIXED+VERIFIED

**Research.** `memory_relations` had no history and no notion of exclusivity:
a new "quinn ferreira maintains weather mast north" sat beside the old "diego
mbeki maintains …", and the merged twins carried two `located_in` edges each.
In the day-1000 world 9 devices had more than one maintainer of record and 5
things more than one location; the agent refused ("two conflicting located_in
links") or answered "not found — maintained by diego mbeki, not quinn
ferreira" — 3 two-hop misses in the act, more under the strict rubric.

**Fix (kernel).** Migration `0027_relation_history` adds
`memory_relation_history` (the retired edge, when it was recorded, when and by
what it was superseded, why); readers of `memory_relations` keep seeing only
current edges, nothing is deleted from the record. `relate()` now knows
**exclusive** relations — `located_in`/`based_in`/`lives_in`/`reports_to`/
`works_at` hold one value per subject, `maintains`/`owns`/`manages` one per
object (verbs normalised: "is located at" → `located_in`) — and a new edge on
one REPLACES the previous edge with history and an audit event
(`relation_superseded`); `additive: true` keeps both ("she ALSO maintains
it"); non-exclusive verbs (`supplies`, `depends_on`, `knows`, `works_on`)
accumulate as before. The tool result says what was replaced. `reconcileRelations`
(`POST /memory/reconcile-relations`, dry-run default; also in the sleep cycle)
brings a pre-rule world to one current edge per anchor — newest wins — and
**skips anchors touched by a twin merge** (foreign aliases now, or an
`entity_alias_split` in the audit): their edges were recorded under a merged
name, recency would only guess, they belong to the re-teach set. The backup
covers the history table.

**Tests.** 3 new in `test/reconcile_homes.test.ts`: a new `located_in`
replaces the old edge (history row, reason, audit, `replaced` in the result);
one maintainer of record per device with other devices untouched, `additive`
keeps both, `supplies` accumulates; reconciliation keeps the newest for a
pre-rule world and skips a twin-touched anchor, dry-run writes nothing,
idempotent. Full suite **515/515, 0 skipped**.

**Manual check, Sonnet 5 (port 4170).** "arjun petrov maintains the field pump
north" → recorded (the agent read the tool's own note that maintains is
exclusive). "Update: esme carvalho now maintains the field pump north instead.
And the field pump two has moved — it's now located at the cold store." → the
agent used `memory.relate` for the maintainer (tool reply: replaced arjun
petrov, kept in history) and `memory.correct` for the location fact; quiz:
"Field pump north is maintained by Esme Carvalho. Field pump two is located at
the cold store."

**Applied to the day-1000 world (audited).** Dry-run: 4 resolvable groups, all
maintainers replaced by chapter-two cross-links (roof array north → Pavel
Bergstrom, air scrubber → esme carvalho, microscope north → pavel hoffmann,
air scrubber two → pavel pereira), 10 groups skipped as twin-touched
(Microscope Two, Aquarium Rig Two, Rooftop Garden Two, kiln north, 3D printer
north — every one of them a G-17 canonical). Applied: 4 `relation_superseded`,
4 history rows. Read-only re-ask: "Who maintains the air scrubber?" → Esme
Carvalho; "Which place is the air scrubber two — the one pavel pereira
maintains — located at?" → Rooftop Garden Two. 0 writes.

**Observation for R7 (G-11).** The agent sometimes stores a location as a
FACT ("field pump two is located at the boat house") rather than a
`located_in` relation, which two-hop traversal cannot follow; the `memory.relate`
description will say that location/maintainer/supplier statements are
relations.

**Status.** G-07 FIXED+VERIFIED; the 10 skipped twin-touched anchors are part
of chapter three's re-teach set.

## R6 — teach receipts (G-01) and facts that carry their subject (G-18) → PREVENTED / FIXED

**Research.** G-01 is the largest miss class (42 of the second act's 89
old-world strict misses): facts the first-act kernel simply never stored, which
no read path can recover. The batch tool (R-MEM-09) already read every item
back; the single `memory.rememberFact` and `memory.remember` answered
"remembered" on trust. G-18 came out of R3: the agent writes "Status colour is
teal" with no subject in the text, so nine folded twins could not be split from
evidence.

**Fix (kernel).** `memory.rememberFact` and `memory.remember` now confirm the
write by **reading it back** and quote the stored text in the result
("remembered and read back — 'coral census two': "coral census two: Status
colour is teal" (factId …)"); a write that does not read back intact is
`ok:false`, never a silent success. `withSubject()` stores a statement that
does not name its entity prefixed with it ("coral census two: Status colour is
teal"), verbatim otherwise, in both the single and the batch tool; `parseSlot`
reads the prefixed form; the tool description asks the agent to name the
entity in the statement and to relay the read-back.

**Tests.** 4 new (`withSubject` cases incl. the first-person exception; the
single tool's stored text + receipt + `parseSlot` on the prefixed form; the
batch prefixes per item; `memory.remember` receipt). One existing test caught
a regression during the slice (an empty statement must stay empty so the store
refuses it) — fixed before commit.

**Manual check, Sonnet 5 (port 4170).** "Remember this about the gantry
crane two: status colour is teal, assigned number is 42." → the agent itself
wrote "gantry crane two's status colour is teal" / "…assigned number is 42"
(the description nudge), the batch read both back; "my podcast length is 12
minutes" → `memory.remember`, "Remembered and read back 'podcast length' =
'12 minutes'"; the quiz answered both. Stored facts read exactly as taught,
with the subject.

**Status.** G-01 PREVENTED — every write is now confirmed by read-back and
quoted; the facts the old kernel dropped are re-taught in chapter three and
their landing checked by the strict scorer. G-18 FIXED — every new fact names
its entity, so any future split is attributable.
