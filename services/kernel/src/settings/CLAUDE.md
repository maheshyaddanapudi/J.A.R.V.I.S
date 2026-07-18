# kernel/src/settings — general runtime settings (D-0058)

The mechanism behind "edit any and all possible things through the UI." A
CATALOG-driven registry: every registered knob is editable at runtime by the
user (UI/API) **and** J.A.R.V.I.S. (gated tool), with the effective value =
**persisted override ?? current default** (defaults evaluated live, never a
frozen snapshot). This is what makes the Command Center a live command center
rather than a start-time-only config screen.

## Pieces
- `registry.ts` — `SettingsRegistry(pool, audit, catalog)`: `effective()` (full
  catalog + effective values for the UI), `get/num/bool/str` (typed reads for
  consumers), `set(key, value, source, reason)` (validated + ledgered), `reset`
  (delete override → back to default). Overrides persist in `runtime_settings`
  (migration 0017) as deltas only, with `{source, reason, updated_at}`.
- `catalog.ts` — `SETTINGS_CATALOG`: the allowlist of editable settings. Each
  `SettingSpec` has a `default: () => value` read LIVE from the code/config
  constant. **To make a new value editable: add a spec here and read it via the
  registry where consumed.** Currently registers the proactivity gate constants
  (were hardcoded in `DEFAULT_GATES`).
- `tools.ts` — `settings.set` (CONSEQUENTIAL, per-request approval + disclosure
  + rollback) / `settings.reset` (LOW_REVERSIBLE): the conversational edit path,
  so instructing J.A.R.V.I.S. flows through policy→approval→audit (D-0055).

## Consumers read live
`ProactivityEngine.run()` rebuilds its gate stack from the registry each cycle,
so a UI/J.A.R.V.I.S. edit takes effect on the **next cycle, no restart** —
verified live (raising `proactive.confidenceThreshold` to 0.99 made the
confidence gate fire "0.95 < 0.99" on the next run).

## Z1 exclusion (R-CAP-08)
The catalog IS the allowlist. Nothing from the trust core
(policy/approval/audit/e-stop/credentials/sandbox) is catalogued, so there is
no key through which those could be edited here. A test asserts the shipped
catalog contains no Z1-shaped keys.

## Routes
`GET /settings` (catalog + effective), `PUT /settings/:key` (user set),
`DELETE /settings/:key` (reset). Command Center panel: `/settings` (generic —
renders whatever is registered, so new knobs appear automatically).

## Dynamic settings (D-0060)
Two origins: SYSTEM (static catalog — the mandatory floor; delete = reset to
default) and DYNAMIC (`setting_specs` migration 0019 — registered at runtime by
J.A.R.V.I.S./user, persisted, fully removable). `init()` reloads dynamic specs
at boot; `register()` refuses Z1 keys + system collisions; `remove()` resets a
system key but deletes a dynamic one. `POST /settings` (register), gated
`settings.register` tool. Panel tags them "◆ discovered".

## Verified (2026-07-18)
5 settings tests (default fallback, persist+reset, type/bounds validation,
unknown-key reject, Z1-exclusion, gated tool round-trip incl. deny-changes-
nothing) + live runtime-effect on proactivity + 7/7 UI panel checks.
