# kernel/src/skills — skills registry (R-CAP-01)

The "skills" registry: user-defined, saved, named objectives J.A.R.V.I.S. can
re-run. It's the reusable-task layer over the agent runtime — turn an ad-hoc
objective into a named skill ("morning briefing", "status check") and run it
again later.

## Files
- `registry.ts` — `SkillRegistry` (migration 0009 `skills`): create / list / get
  / delete / run. `run(id)` executes the skill's `objective` through the injected
  `AgentRuntime`.

## Safety
- A skill **grants no new capability**. Running it goes through the agent, which
  runs every step through the gated core loop — so a consequential step still
  requires approval, the e-stop still halts, and the step budget still bounds it.
  A skill only *names and reuses* what the agent can already do.
- Unique active name (soft-supersede on re-create); soft-delete (disable).
  `skill_created` / `skill_run` / `skill_deleted` audited.

## Routes
`GET /skills` · `POST /skills {name, objective, description?, maxSteps?}` ·
`DELETE /skills/:id` · `POST /skills/:id/run` → the agent result.

## Verified (2026-07-17)
5 tests (create/list/run-through-agent; unique-name supersede; delete disables +
run-absent → null; autoApprove passthrough; empty name/objective rejected). Live:
create "status check" → run → agent called `system.info` through the gated loop →
synthesized answer; audit `skill_created → skill_run → agent_run_started →
tool_call`.

## Next
A Command Center skills panel (save/run/delete); scheduled skills (via the
proactivity engine, gated on D-0024); parameterized skills; export/import.
This is the first of R-CAP-01's registries; rules/workflows follow the same shape.
