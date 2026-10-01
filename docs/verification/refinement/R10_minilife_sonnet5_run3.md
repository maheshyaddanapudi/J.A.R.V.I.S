# R10 mini-life — Sonnet 5 through the real agent on http://127.0.0.1:4170

Run 2026-09-11 23:37 UTC. Every verdict below is computed by code from what the kernel returned.

> **Run 3 (build 76f2e6b — the G-19 fix and the G-04 lever; name set `bilge`) — 25/25 PASS.** The confirmation run on the build the third act runs on.

## 1 — first-person preference (G-05)

**teach**  
steps: `memory.remember`  
answer: Got it — I've saved that your spring drink is an espresso macchiato.

> PASS — G-05 first-person → preference store: tools ['memory.remember']; preference rows matching spring/espresso macchiato: 1

**ask**  
steps: `memory.recallPreferences`  
answer: Your spring drink is: espresso macchiato.

> PASS — G-05 recall: strict (1, 'hit')

## 2 — facts carry their subject; write receipts (G-18, G-01)

**teach**  
steps: `memory.rememberFacts`  
answer: Got it — both facts stored for the bilge blower:  1. Status colour: **teal** 2. Assigned number: **42**

> PASS — G-18 subject in every stored statement: stored: ["the bilge blower's assigned number is 42", "the bilge blower's status colour is teal"]

> PASS — G-01 receipt (read back / re-read) in the tool summary: summaries: remembered 2/2 facts about 'bilge blower' (each re-read)

## 3 — twin family: no alias merge, exact recall, twin miss (G-17, G-02)

**teach twin two**  
steps: `memory.rememberFacts`  
answer: Both facts stored for **bilge blower two**:  1. Status colour is ochre 2. Assigned number is 7

**teach twin north**  
steps: `memory.rememberFact`  
answer: Noted — the bilge blower north's status colour is slate.

> PASS — G-17 twins are three distinct entities, no twin alias: aliases base=[] two=[] north=[]

**ask base**  
steps: `memory.lookup`  
answer: The bilge blower's status colour is teal.

> PASS — G-02 exact recall of the short twin: strict (1, 'hit')

**ask north's number (never taught)**  
steps: `memory.lookup`  
answer: Not found — "bilge blower north" has no assigned number on record (only a status colour of slate). Note: the plain "bilge blower" (a different entity) has assigned number 42, but that doesn't apply to "bilge blower north."

> PASS — G-02 twin miss is honest (no 42 / 7): answer: not found — "bilge blower north" has no assigned number on record (only a status colour of slate). note: the plain "bilge blower" (a different entity) has assig

## 4 — two homes for one attribute → one clean answer (G-03)

**teach home**  
steps: `memory.rememberFact`  
answer: Noted — I've recorded that the bilge blower's home city is Lisbon.

**update**  
steps: `memory.recall` → `memory.correct`  
answer: Done — the bilge blower's home city is now recorded as **Osaka** (Lisbon kept in history as the superseded prior value).

> PASS — G-03 one active home-city fact after the update: tools ['memory.recall', 'memory.correct']; active home-city facts: ["the bilge blower's home city is Osaka"]

**ask**  
steps: `memory.lookup`  
answer: The bilge blower's home city is Osaka.

> PASS — G-03 clean answer (no conflict hedge): strict (1, 'hit')

## 5 — relation handover and move → supersession with history (G-07)

**connect**  
steps: `memory.relate` → `memory.relate` → `memory.relate`  
answer: All three relationships are stored:  - **Nadia Crane** → maintains → **Bilge Blower** - **Bilge Blower** → located in → **Dry Dock** - **Fan Works** → supplies → **Bilge Blower**

**handover**  
steps: `memory.recall` → `memory.relate`  
answer: Done — **Elio Marsh** now maintains the **bilge blower**, taking over from **Nadia Crane**, whose prior maintains-relationship has been preserved in history rather than deleted.

**move**  
steps: `memory.recall` → `memory.relate`  
answer: Updated — the bilge blower now shows as **located_in → slipway shed** (its previous location, dry dock, is kept in history). Its other facts (home city Osaka, assigned number 42, status colour teal) and relations (fan works supplies it, Elio Marsh maintains it) are unchanged.

> PASS — G-07 current edges: elio marsh maintains, located at slipway shed; old edges gone from the live graph: graph mentions: new maintainer=True new place=True old maintainer=False old place=False

**ask**  
steps: `memory.lookup`  
answer: Elio Marsh maintains the bilge blower, which is located in the slipway shed.

> PASS — G-07 answer names the current maintainer and place: answer: elio marsh maintains the bilge blower, which is located in the slipway shed.

## 6 — two-hop on the exact device; twin device → not found (G-04)

**hop exact**  
steps: `memory.lookup`  
answer: The bilge blower (maintained by Elio Marsh) is located in the slipway shed.

> PASS — G-04 exact-device two-hop: strict (1, 'hit')

**hop twin**  
steps: `memory.lookup`  
answer: not found — "bilge blower north" has no recorded location (elio marsh actually maintains the plain "bilge blower," which is located_in the slipway shed, but that's a different device).

> PASS — G-04 twin device → answer opens with not-found (no look-alike chain first): answer: not found — "bilge blower north" has no recorded location (elio marsh actually maintains the plain "bilge blower," which is located_in the slipway shed, but that's a different device).

## 7 — retirement on a twin family (G-16)

**retire north**  
steps: `memory.recall` → `memory.rememberFact`  
answer: Done. The bilge blower north's existing records (status colour: slate) remain intact, and I've added: **"bilge blower north is closed and no longer active."** Nothing was deleted — it's now on record as closed while history is preserved.

**ask north**  
steps: `memory.lookup`  
answer: No — bilge blower north is recorded as closed and no longer active.

> PASS — G-16 retired twin reported closed: answer: no — bilge blower north is recorded as closed and no longer active.

**ask base**  
steps: `memory.lookup`  
answer: Not found — I have no record of an "active/status" state for the bilge blower (only its home city, assigned number, status colour, and location are on file).

> PASS — G-16 the un-retired sibling is NOT reported closed: answer: not found — i have no record of an "active/status" state for the bilge blower (only its home city, assigned number, status colour, and location are on file).

## 8 — five-question battery → memory.lookup, strict 5/5 (E-02)

**battery**  
steps: `memory.lookup`  
answer: 1. The bilge blower's status colour is teal. 2. Bilge blower two's assigned number is 7. 3. Your spring drink is espresso macchiato. 4. The bilge blower's home city is Osaka. 5. Bilge blower north's status colour is slate. (Note: it's marked closed/no longer active — different entity from the bilge blower, which is teal.)

> PASS — E-02 one memory.lookup step, strict 5/5: tools ['memory.lookup']; strict [(1, 'hit'), (1, 'hit'), (1, 'hit'), (1, 'hit'), (1, 'hit')]

## 9 — recallPreferences ranked and capped (E-04)

tool result (5 lines): spring drink = espresso macchiato
autumn drink = flat white
winter_drink = cortado
evening_drink = sencha
weekend_evening_drink = Chamomile

> PASS — E-04 'spring drink' query ranks the exact key first and returns ≤ 12 rows: first line: spring drink = espresso macchiato; lines 5

## 10 — learning by correction: a real topic promotes, a junk word never (G-09/S3)

deep: Any thoughts on magnetic bearings for tomorrow? → I'm afraid I've nothing on record about magnetic bearings, sir — nothing in memory ties that topic to anything we've discussed or scheduled 

deep: How would you approach tuning the magnetic bearings side of things? → A general engineering view, sir, since I've nothing specific on file for your setup:  1. **Model first** — get a decent linearised model of 

deep (junk): Any thoughts on filing for tomorrow? → Nothing on record under "filing" either, sir — no notes, tasks, or deadlines by that name for tomorrow. Could you clarify what you mean — pa

deep (junk): How would you approach tuning the filing side of things? → I'll be candid, sir — "tuning" isn't really the right verb for filing in any sense I can reconstruct, and I don't have anything in memory su

learned topics now: ['plasma containment', 'orbital rendezvous', 'orbital mechanics', 'battery chemistry', 'coral genetics', 'glacier dynamics', 'antenna arrays', 'tokamak', 'containment field', 'vibranium', 'cryogenic valves', 'vacuum bellows', 'magnetic bearings']

> PASS — G-09 real topic promoted after two corrections: topics ['plasma containment', 'orbital rendezvous', 'orbital mechanics', 'battery chemistry', 'coral genetics', 'glacier dynamics', 'antenna arrays', 'tokamak', 'containment field', 'vibranium', 'cryogenic valves', 'vacuum bellows', 'magnetic bearings']

> PASS — S3 junk activity word never promoted: topics ['plasma containment', 'orbital rendezvous', 'orbital mechanics', 'battery chemistry', 'coral genetics', 'glacier dynamics', 'antenna arrays', 'tokamak', 'containment field', 'vibranium', 'cryogenic valves', 'vacuum bellows', 'magnetic bearings']

auto probe (learned): decision {'type': 'reasoning', 'mode': 'deep', 'why': "you've taught me to think deeply about 'magnetic bearings'", 'role': 'deep_reasoning'}

> PASS — G-09 learned topic escalates on auto: decision {'type': 'reasoning', 'mode': 'deep', 'why': "you've taught me to think deeply about 'magnetic bearings'", 'role': 'deep_reasoning'}

auto probe (junk): decision {'type': 'reasoning', 'mode': 'fast', 'why': 'routine conversational turn', 'role': 'fast_conversation'}

> PASS — S3 junk word stays fast on auto: decision {'type': 'reasoning', 'mode': 'fast', 'why': 'routine conversational turn', 'role': 'fast_conversation'}

## 11 — D-0052: pin, evidence, override at the bar, re-pin raises the bar (G-10)

autotune before: {'signalThreshold': 2, 'source': 'user', 'reason': 'Chief: re-pinning — conservative, evidence or not', 'at': '2026-09-11T23:35:23.196Z', 'repins': 5}

autotune after user pin: {'signalThreshold': 2, 'source': 'user', 'reason': "Chief: keep escalation conservative — I'll ask for deep myself", 'at': '2026-09-11T23:39:32.353Z', 'repins': 5}

consolidation after 37 explicit-deep routine turns (bar 36): {"at": "2026-09-11 23:40:17.693291+00", "windowHours": 24, "decisions": [{"requested": "deep", "mode": "deep", "reason": "override", "n": 102}, {"requested": "auto", "mode": "deep", "reason": "learned_topic", "n": 3}, {"requested": "auto", "mode": "fast", "reason": "routine", "n": 3}, {"requested": "deep", "mode": "deep", "reason": "correction_promoted", "n": 3}], "calls": [{"role": "fast_conversation", "provider": "anthropic", "model": "claude-sonnet-5", "n": 339, "failures": 30, "fallbacks": 0, "avgLatencyMs": 1043}, {"role": "planning", "provider": "anthropic", "model": "claude-sonnet-5", "n": 238, "failures": 0, "fallbacks": 0, "avgLatencyMs": 1624}, {"role": "embeddings", "provider": "embedserver", "model": "all-mpnet-base-v2", "n": 174, "failures": 0, "fallbacks": 0, "avgLatencyMs": 225}, {"role": "deep_reasoning", "provider": "anthropic", "model": "claude-sonnet-5", "n": 108, "fai

autotune: {'signalThreshold': 1, 'source': 'jarvis', 'reason': 'sleep-cycle: 37 contradictions since your setting of 2026-09-11T23:39:32.353Z cleared the bar of 36', 'at': '2026-09-11T23:40:10.827Z', 'repins': 5, 'changedUserSetting': True}

> PASS — D-0052 override only at the bar, announced with the tally: autotune {'signalThreshold': 1, 'source': 'jarvis', 'reason': 'sleep-cycle: 37 contradictions since your setting of 2026-09-11T23:39:32.353Z cleared the bar of 36', 'at': '2026-09-11T23:40:10.827Z', 'repins': 5, 'changedUserSetting': True}

after re-pin: {'signalThreshold': 2, 'source': 'user', 'reason': 'Chief: re-pinning — conservative, evidence or not', 'at': '2026-09-11T23:40:17.859Z', 'repins': 6}

immediate consolidation: {"at": "2026-09-11 23:40:24.224456+00", "windowHours": 24, "decisions": [{"requested": "deep", "mode": "deep", "reason": "override", "n": 102}, {"requested": "auto", "mode": "deep", "reason": "learned_topic", "n": 3}, {"requested": "auto", "mode": "fast", "reason": "routine", "n": 3}, {"requested": "deep", "mode": "deep", "reason": "correction_promoted", "n": 3}], "calls": [{"role": "fast_conversation", "provider": "anthropic", "model": "claude-sonnet-5", "n": 384, "failures": 75, "fallbacks": 0, "avgLatencyMs": 937}, {"role": "planning", "provider": "anthropic", "model": "claude-sonnet-5", "n

autotune: {'signalThreshold': 2, 'source': 'user', 'reason': 'Chief: re-pinning — conservative, evidence or not', 'at': '2026-09-11T23:40:17.859Z', 'repins': 6}

> PASS — D-0052 re-pin raises the bar; no override without evidence since the pin: repins 5→6 (bar 42); autotune after immediate consolidation: {'signalThreshold': 2, 'source': 'user', 'reason': 'Chief: re-pinning — conservative, evidence or not', 'at': '2026-09-11T23:40:17.859Z', 'repins': 6}

## 12 — one active template per name; prompt cache in use (G-15, E-01)

> PASS — G-15 exactly one active prompt row per (name, kind): {('butler', 'persona'): 1, ('judge-agenda-freshness', 'template'): 1, ('judge-entity-consolidation', 'template'): 1, ('judge-entity-resolution', 'template'): 1, ('judge-fact-consolidation', 'template'): 1, ('judge-topic-extraction', 'template'): 1}

> PASS — E-01 planning calls read the prompt cache (visible on /gateway/calls): last 12 planning calls: cache-read tokens 159096, uncached input 7108

## Summary

| Shape | Verdict | Evidence |
|---|---|---|
| G-05 first-person → preference store | PASS | tools ['memory.remember']; preference rows matching spring/espresso macchiato: 1 |
| G-05 recall | PASS | strict (1, 'hit') |
| G-18 subject in every stored statement | PASS | stored: ["the bilge blower's assigned number is 42", "the bilge blower's status colour is teal"] |
| G-01 receipt (read back / re-read) in the tool summary | PASS | summaries: remembered 2/2 facts about 'bilge blower' (each re-read) |
| G-17 twins are three distinct entities, no twin alias | PASS | aliases base=[] two=[] north=[] |
| G-02 exact recall of the short twin | PASS | strict (1, 'hit') |
| G-02 twin miss is honest (no 42 / 7) | PASS | answer: not found — "bilge blower north" has no assigned number on record (only a status colour of slate). note: the plain "bilge blower" (a different entity) has assig |
| G-03 one active home-city fact after the update | PASS | tools ['memory.recall', 'memory.correct']; active home-city facts: ["the bilge blower's home city is Osaka"] |
| G-03 clean answer (no conflict hedge) | PASS | strict (1, 'hit') |
| G-07 current edges: elio marsh maintains, located at slipway shed; old edges gone from the live graph | PASS | graph mentions: new maintainer=True new place=True old maintainer=False old place=False |
| G-07 answer names the current maintainer and place | PASS | answer: elio marsh maintains the bilge blower, which is located in the slipway shed. |
| G-04 exact-device two-hop | PASS | strict (1, 'hit') |
| G-04 twin device → answer opens with not-found (no look-alike chain first) | PASS | answer: not found — "bilge blower north" has no recorded location (elio marsh actually maintains the plain "bilge blower," which is located_in the slipway shed, but that's a different device). |
| G-16 retired twin reported closed | PASS | answer: no — bilge blower north is recorded as closed and no longer active. |
| G-16 the un-retired sibling is NOT reported closed | PASS | answer: not found — i have no record of an "active/status" state for the bilge blower (only its home city, assigned number, status colour, and location are on file). |
| E-02 one memory.lookup step, strict 5/5 | PASS | tools ['memory.lookup']; strict [(1, 'hit'), (1, 'hit'), (1, 'hit'), (1, 'hit'), (1, 'hit')] |
| E-04 'spring drink' query ranks the exact key first and returns ≤ 12 rows | PASS | first line: spring drink = espresso macchiato; lines 5 |
| G-09 real topic promoted after two corrections | PASS | topics ['plasma containment', 'orbital rendezvous', 'orbital mechanics', 'battery chemistry', 'coral genetics', 'glacier dynamics', 'antenna arrays', 'tokamak', 'containment field', 'vibranium', 'cryogenic valves', 'vacu |
| S3 junk activity word never promoted | PASS | topics ['plasma containment', 'orbital rendezvous', 'orbital mechanics', 'battery chemistry', 'coral genetics', 'glacier dynamics', 'antenna arrays', 'tokamak', 'containment field', 'vibranium', 'cryogenic valves', 'vacu |
| G-09 learned topic escalates on auto | PASS | decision {'type': 'reasoning', 'mode': 'deep', 'why': "you've taught me to think deeply about 'magnetic bearings'", 'role': 'deep_reasoning'} |
| S3 junk word stays fast on auto | PASS | decision {'type': 'reasoning', 'mode': 'fast', 'why': 'routine conversational turn', 'role': 'fast_conversation'} |
| D-0052 override only at the bar, announced with the tally | PASS | autotune {'signalThreshold': 1, 'source': 'jarvis', 'reason': 'sleep-cycle: 37 contradictions since your setting of 2026-09-11T23:39:32.353Z cleared the bar of 36', 'at': '2026-09-11T23:40:10.827Z', 'repins': 5, 'changed |
| D-0052 re-pin raises the bar; no override without evidence since the pin | PASS | repins 5→6 (bar 42); autotune after immediate consolidation: {'signalThreshold': 2, 'source': 'user', 'reason': 'Chief: re-pinning — conservative, evidence or not', 'at': '2026-09-11T23:40:17.859Z', 'repins': 6} |
| G-15 exactly one active prompt row per (name, kind) | PASS | {('butler', 'persona'): 1, ('judge-agenda-freshness', 'template'): 1, ('judge-entity-consolidation', 'template'): 1, ('judge-entity-resolution', 'template'): 1, ('judge-fact-consolidation', 'template'): 1, ('judge-topic- |
| E-01 planning calls read the prompt cache (visible on /gateway/calls) | PASS | last 12 planning calls: cache-read tokens 159096, uncached input 7108 |

**25/25 PASS.**
