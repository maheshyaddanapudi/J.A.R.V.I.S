# kernel/src/proactive — proactivity engine (Phase 4 foundation)

Movie-style but controlled proactive behavior (R-PRO-01…03): relevant, sparse,
gated, explained, and NEVER consequential without approval.

## Pipeline
`generators.ts` turn real stored data into candidates (upcoming/overdue
commitments, calendar conflicts, a daily briefing) → `gates.ts` filters through
the gate stack → `engine.ts` records survivors + emits to the activity timeline.
All read-only over data; the engine surfaces information/suggestions only and has
no consequential-action path (those go through the policy/approval flow).

## Gate stack (`gates.ts`), in order
per-domain enable → min priority → confidence threshold → quiet hours (critical
bypasses) → snooze/dismiss → dedup → rate limit. Every suppression is recorded
with its reason (never silent). Each surfaced item carries a "why am I seeing
this" explanation. `now` is always injected (deterministic, testable).

## Data (migration 0006)
`commitments` (deadlines), `calendar_events`, `proactive_items` (surfaced, dedup-
unique), `proactive_snoozes` (snooze/dismiss), `proactive_domain_settings`.

## User-defined rules (`rules.ts`, migration 0014, D-0044, R-CAP-01 "rules" kind)
Makes WHAT J.A.R.V.I.S. is proactive about **user-configurable**: `ProactiveRules`
(list/set/setEnabled/remove/evaluate). A rule's condition is a **closed, typed
set** — `part_of_day`, `commitment_due_within{minutes}`, `commitment_overdue` —
evaluated in code (`parseCondition` refuses anything else on write, so a rule can
NEVER execute code/shell). `evaluate(now)` turns enabled rules into `Candidate`s
that `engine.run()` appends to the built-in generators and runs through the SAME
gate stack — suggestion-only, never acts. Detail templates fill only
`{commitment}`/`{due}` (plain replace). Best-effort: a rule failure never breaks a
cycle. Background *delivery* is still gated at D-0024; rules only configure what's
computed on demand.

## API
`/proactive/{items, run (optional `at` preview time), snooze, dismiss, domain,
rules (list/set), rules/:name/enabled, rules/:name (delete)}`.

## Verified (2026-07-17)
10 proactive tests (79 kernel total). Live: daytime run surfaced overdue/due/
conflict items with "why"; 3am run suppressed all 5 via quiet hours; audit
recorded each cycle, chain intact.

## GATE (docs/06) — D-0024
Live BACKGROUND proactive delivery (scheduling + push notifications) requires the
"before enabling proactive behavior" check-in. This engine computes on demand and
records; it is NOT wired to a scheduler or notifications until that check-in.

## Next (after the check-in)
Background scheduler, morning/evening briefing delivery, meeting prep, comms
surfacing, topic monitoring, device/service anomaly detection, escalation policy.
