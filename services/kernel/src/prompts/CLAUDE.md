# kernel/src/prompts — the prompts registry (R-CAP-01 "prompts" kind, D-0043)

Makes J.A.R.V.I.S.'s **persona and named system prompts** a real, versioned,
user-editable entity instead of hardcoded strings — one of the R-CAP-01 "no fixed
connector list" registry kinds (tools/models/MCP/capabilities/devices/skills already
exist; this adds prompts). The user controls *how J.A.R.V.I.S. speaks* (the
"British-butler manner") as data, not code.

## Files
- `registry.ts` — `PromptRegistry` over the `prompts` table (migration 0013):
  `getActive(kind)`, `activePersonaOr(fallback)`, `list`, `get`, `set` (create or
  supersede — increments version, keeps exactly one active per kind), `activate`,
  `remove`. Supersede-with-history (R-MEM-05); secrets **redacted** on write (a
  persona must never carry a key).

## Integration
- Migration 0013 **seeds** the D-0004 butler persona so the registry is populated on
  first run.
- `/core/converse` reads the **active** persona via `activePersonaOr(BUTLER_PERSONA)`
  — the hardcoded default is the fallback, so conversation is **never** left without
  a persona even if the registry is empty or unavailable.
- Routes (`core/routes.ts`): `GET /prompts` (list + active), `GET /prompts/active`,
  `POST /prompts` (set), `POST /prompts/:name/activate`, `DELETE /prompts/:name`.

## Guarantees
- **Never a blank persona** — fallback to the built-in default on empty/unavailable.
- **Exactly one active** prompt per kind (the loop reads one persona).
- **No secrets** in prompts — redacted on write.
- **Local** — persona/prompt content stays in the local DB.

## Verified (2026-07-17)
7 registry tests (set→active, supersede+version with one active, switch-name
deactivates prior, activate toggles, activePersonaOr fallback→override, secret
redaction, remove-all-versions). Live 6/6: the seeded persona AND a registry-set
custom persona each really reached the model through `/core/converse` (echo
chat-model through the real gateway). Harness `P-PROMPT-01`.

## Next
More R-CAP-01 kinds as phases need them (rules/workflows/agents/plugins/
integrations/…); a Command Center panel to view/edit the persona; wiring the agent
system prompt through the registry too (currently only the conversation persona).
