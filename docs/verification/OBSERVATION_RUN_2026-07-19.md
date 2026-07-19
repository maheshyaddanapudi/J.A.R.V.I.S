# Observation run — 70/30 conversations, memory/heartbeat/quiet-hours/drift/self-creation

**Date:** 2026-07-19 · **Brain:** real Anthropic (Haiku fast / Sonnet-5 deep) ·
factory-state `jarvis_obs` DB. Answers the user's 7 questions from ground truth,
including the bug this run surfaced (and fixed).

## Volume
~120 conversations · 328 conversation turns (100% encrypted at rest) · 441 model
calls · ~$1.79. 40 memory-recording entities (35 unique / 5 recurring), 70/30 by
design. Breadth: 51 conversations across 51 topics + 12 repeated-topic threads.

## 1. Memory recording + duplicates (the headline finding — a bug, now fixed)
- **Durable entity/fact memory is written via the agent path** (J.A.R.V.I.S.'s
  own `memory.rememberEntity`/`rememberFact`); pure chat writes only conversation
  turns. So "live" durable writes = when it decides to record.
- **Duplicates: YES, two kinds.**
  1. *Name-variant active duplicates* (genuine model behavior): "Pepper" vs
     "Pepper Potts", "Mark 42" vs "Mark 42 suit" — the model names the same
     real-world thing inconsistently across stateless sessions, so they become
     separate active entities. NOT auto-merged.
  2. *Concurrency-race same-name duplicates* (partly a harness artifact): my
     5-worker harness raced parallel `rememberEntity("arc reactor")` inserts;
     under READ COMMITTED the supersede-then-insert didn't see the racing insert,
     leaving up to 4 active "arc reactor" rows. Real single-user use is
     sequential, so this is largely a test artifact — but the supersession then
     revealed a worse bug ↓
- **BUG FOUND — fact fragmentation → J.A.R.V.I.S. forgot facts.** `rememberEntity`
  supersedes-and-recreates the entity on every mention; facts stayed bound to the
  entity version active when they were added. So after 4 separate mentions of the
  arc reactor, recall returned **only 1 fact** — the other 3 were stranded on
  superseded versions. That directly undermines "remembers everything you tell
  it."
- **FIXED (committed):** on supersede, migrate the still-active facts (and
  relations, conflict-safely) forward to the live entity. Re-verified: the same
  4-mention scenario now recalls **3 facts** (up from 1; the 4th landed under a
  differently-named entity — the name-variant issue above). Entity-attribute
  history is preserved on the superseded rows; knowledge accumulates on the live
  entity. New unit test + 357 kernel tests pass.
- **Three memory contexts observed:** LIVE writes (agent, immediate);
  HEARTBEAT writes (a beat recorded an episode via `memory.recordEpisode`);
  QUIET-HOURS consolidation (below).

## 2. Announcements outside quiet hours
With the quiet window set to exclude "now," heartbeat announcements surfaced
**immediately** (`deferred=false`) — 4 of them. Deterministic cross-check:
non-urgent in quiet hours → `deferred=true` ("queued for after quiet hours");
urgent in quiet hours → `deferred=false` (breaks through). All three branches
confirmed in the DB.

## 3. Behavioral drift from factory
- Factory baseline snapshot: 0 learned topics, autotune threshold 2 (default),
  all settings at default source.
- **After the run:** learned deep-topics went `[]` → `['quick','palladium',
  'metallurgy','one-line','intuition']` — drift is REAL (forced deep-reasoning
  corrections on recurring topics promoted them). **Honest imperfection:** the
  salient-term extractor grabbed generic words ('quick','one-line','intuition')
  from my prompt phrasing alongside the real topic terms ('palladium',
  'metallurgy') — the learned topics are noisy.
- Autotune threshold stayed 2 (the sleep cycle's bounded adjustment didn't move
  it this run). No unintended drift in gateway roles or Z1-excluded settings.

## 4. Heartbeats accepted vs not executed
- 6 beats, **6 thought** (all accepted the brain pass). None deferred (I stayed
  quiet; `deferWhileActiveMinutes` deferral was verified in the prior run).
- **Self-restraint on consequential actions:** given a "close the open garage
  door" situation, J.A.R.V.I.S. did NOT try to force a device action on a beat —
  it announced the risk and **re-queued it for user approval** ("cannot execute
  without user approval at this hour"). The LOW_REVERSIBLE ceiling worked at the
  judgment level; the model didn't even attempt the consequential tool. (A hard
  auto-DENY of a planted consequential trap was verified separately in D-0064.)
- "DENIED" steps in beats were mostly precondition failures (device not found,
  no page open), not approval denials — honest distinction.

## 5. Quiet-hours consolidation
- The sleep cycle ran and scanned entities each time (`entitiesScanned` 1–33).
- It merged 0 near-duplicate facts in the main run — **because the fragmentation
  bug had already scattered the near-dups onto superseded entities, out of
  consolidation's per-active-entity reach.** One root cause (the supersede churn)
  explained BOTH the fact loss AND why consolidation had nothing to merge.
- After the fix, with two true near-duplicate facts on one active entity,
  consolidation **merged 1** (`duplicatesMerged: 1`) at overlap 0.6. At the
  default 0.7 my example scored jaccard 0.667 and correctly declined — it works,
  the threshold is just strict, and "robotic" vs "robot" isn't stemmed together.

## 6. Self-created skill (MD) vs self-written code
- **Simple MD (no code):** J.A.R.V.I.S. wrote a real markdown fire-safety
  checklist to `workshop-safety.md` itself (via `workspace.writeNote`). ✓
- **New code:** it wrote `fib.py`, registered `capability:fib-15`, which
  activated and ran its own code. ✓ (Also `word-stats`/`twin-prime-finder`
  earlier.)
- **Honest asymmetry (a gap):** the *skills registry* (saved named objectives)
  has **no self-creation tool** — skills are created via the human `POST /skills`
  route only. So J.A.R.V.I.S. can self-author a CODE capability but not a no-code
  "skill" entry. Closing that would need a gated `skill.save` tool.

## 7. Everything else observed
- **Butler persona** held across 51 topics; **refusals** held (verified in prior
  adversarial run). **Encryption at rest:** 328/328 conversation turns `v1.gcm.*`,
  0 plaintext. **Audit chain** intact. **Deep-reasoning escalation** fired on
  hard turns. **Spend metering** tracked ~$1.79 across the run.
- **Superseded_by history chains:** intact (every superseded entity linked
  forward).

## Bugs found this run
1. **Fact fragmentation on re-mention → fact loss** — FIXED + tested + re-verified.
2. **Name-variant entity duplicates** ("Pepper"/"Pepper Potts") — open; needs
   fuzzy entity resolution at write time.
3. **No self-creation tool for no-code skills** — open; asymmetric with code caps.
4. **Learned-topic term extraction is noisy** (grabs prompt filler words) — open.
5. Concurrency race in `rememberEntity` under parallel writes — largely a harness
   artifact (single-user is sequential); a partial unique index would harden it.

Key was env-only and scrubbed (0 hits in repo + scratch).
