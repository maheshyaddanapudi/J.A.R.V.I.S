# Clean-slate evolution acceptance run — 2026-07-19 (D-0063)

**Questions under test (user):** on a clean slate — (1) hundreds of multi-turn
conversations across interfaces with new/modified/dropped memories and settings
popping up in A2UI as J.A.R.V.I.S. evolves; (2) *behavioral* change as it adapts,
not just table rows; (3) memories updating **live, during quiet hours, or both**
("I prefer both").

Setup: pristine DB `jarvis_scale3` (dropped after), fresh vault, kernel rebuilt
with D-0062 fixes + new D-0063 consolidation, real Anthropic brain (key
vault-only; scrubbed after — 0 hits repo/scratch). All claims below are DB
ground truth or live SSE/API observation.

## 1 · Volume + evolution (fixed build)
- **106 sessions / 744 conversation turns** (100-session harness + probes +
  agent conversations), **100/100 continuity**, 100 auto deep-escalations.
- 45 agent objectives + 5 skills; **0 failures anywhere; 506/506 Anthropic
  calls OK** (Haiku volume, Sonnet-5 deep); audit chain intact (1,263 entries).
- Memory evolution: 21 active entities · **4 superseded (modified w/ history)**
  · **5 deleted (agent `memory.forget`)** · 24 active facts · **2 superseded
  facts, both forward-linked** · 11 relations · 23 episodes.
- Settings/A2UI evolution: **6 dynamic settings registered by J.A.R.V.I.S.**
  (`user.temperatureUnit`, `proactivity.boldness`, `persona.formality`,
  `briefing.morningTime`, `proactive.nudges.maxPerDay`, `user.timezoneOffset` —
  zero near-duplicates, the D-0062 guard holding at volume) + **8 A2UI panels
  composed**; organic tool use included `settings.list`×9, `memory.correct`,
  `memory.forget`×6.

## 2 · Behavioral evolution (the system CHANGES, observably)
- **Probe A — learning by correction changes routing.** "Quick thought on the
  microfluidics manifold?" auto-routed **fast** ("routine conversational turn").
  Two explicit-deep corrections later, promotion was announced ("noted, I'll
  think deeply about 'microfluidics', 'manifold'"). A NEW auto turn on the topic
  then routed **deep**: *"you've taught me to think deeply about
  'microfluidics'"*. The adaptation is in its own journal: reasons
  `correction_promoted` and `learned_topic` appear in `reasoning_decisions`.
- **Probe B — memory changes answers across interfaces and sessions.** Dinner
  question in a fresh session: generic butler advice. The **agent** interface
  then stored a shellfish allergy. The same question in a **brand-new chat
  session**: *"Given your severe shellfish allergy, I would recommend avoiding
  any seafood dishes…"*. Cross-interface, cross-session behavior change.

## 3 · Memories: live AND quiet hours — both verified
- **Live:** every remember/correct/forget/episode during the run landed
  immediately (744 turns' worth; Probe B is live-write → next-conversation use).
- **Quiet hours (new, D-0063):** `EntityMemory.consolidate()` wired into the
  sleep cycle, run by the background scheduler's REAL timer
  (`autonomy.intervalMinutes=1` for the test):
  - tick fired unattended → `{consolidated: true}`; **re-armed itself after a
    kernel restart** from persisted settings;
  - merged the seeded near-duplicate — "Pepper reviews the investor deck"
    superseded by "Pepper is reviewing the Q3 investor deck this week" (fuller,
    newer kept; "met Pepper at the Tokyo office" untouched); history kept +
    forward-linked; audit `memory_consolidated {duplicatesMerged: 1,
    entitiesScanned: 21}`; sleep-cycle episodes on the timeline;
  - stale entities are **proposed for review, never auto-forgotten** (R-MEM-04);
  - thresholds are catalogued editable settings
    (`memory.consolidation.overlap`, `.staleDays`) — A2UI-renderable like any
    other knob.
- **Bug found live + fixed:** first tick missed "review**s**" vs
  "review**ing**" (token mismatch, jaccard 0.43) — added light suffix-stemming
  to content-word matching + regression test; second real tick merged it.

## Tests
**305/305 kernel tests** (up from 302): consolidate merge/idempotence,
stale-proposal-never-forget, morphology merge, + the D-0062 suite.

## Honest scope notes
- The quiet-hours test drove the interval to 1 minute to observe REAL timer
  fires in-session; production default is 30 min and "quiet hours" scheduling
  (only overnight) is a proactivity-gate concern, not yet a consolidation
  schedule window. The mechanism (unattended timer → consolidation) is what was
  verified.
- Fact-level consolidation covers same-entity duplicate statements; it does not
  yet merge duplicate *entities* (e.g. "Pepper" vs "Pepper Potts") — proposal
  territory for a future pass, kept out of scope deliberately (higher risk of
  wrong merges).
