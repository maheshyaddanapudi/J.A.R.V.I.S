# kernel/src/selfext — self-extension (Phase 3)

The HIGHEST-RISK subsystem (docs/02 §Dynamic capability). Built safety-first:
the **hard limit**, **Stage A generate-without-activate**, and — after the
dedicated security check-in (D-0073 APPROVED 2026-07-19) — **Stage B controlled
activation**. Activation is safe-by-construction: an activated capability can
only ever COMPOSE existing gated tools, never run manifest code or reach Z1, and
the R-CAP-08 envelope is re-validated at activation.

## The hard limit (R-CAP-08) — `protected.ts` + `guard.ts`
Non-negotiable structural enforcement: NO generated capability may create/alter/
bypass security policy, approval, audit, e-stop, credential/vault storage,
sandbox, permission-escalation, or the installer. Enforced deny-first by scanning
the proposed manifest's files + permissions + content:
- `PROTECTED_PATHS` — core/, crypto/, selfext protected files, migrations,
  config, infra, .github — any create/modify/delete is a hard reject.
- `PROTECTED_PERMISSIONS` — policy/approval/audit/estop/credential/vault/sandbox/
  install/escalate scopes — requesting any is a hard reject.
- protected-symbol patterns (AuditLog, EmergencyStop, Vault, JARVIS_MASTER_KEY,
  DROP TABLE, …) and path traversal.
A hard-limit hit is TERMINAL: the capability can never advance. This module is
itself a protected path.

## Stage A — `stageA.ts` + `registry.ts`
`StageAPipeline.run(manifest)` → guard scan → capability report + verdict →
registry record. Clean ⇒ `awaiting_review`; rejected ⇒ `scanned_rejected`. It
exposes ONLY `run()` — no install/activate/execute method exists (asserted by a
test). Pre-Phase-3 safe behavior: `registry.recordGap()` records missing
capabilities without claiming J.A.R.V.I.S. can generate/activate them.

Registry `recordStageA` also persists the executable `composition` (D-0073) so
Stage B can reconstruct + re-validate it; a re-scan resets any prior activation.

## Stage B — `activation.ts` + migration 0024 (D-0073, APPROVED)
`ActivationService.activate(name)` re-validates the R-CAP-08 envelope against the
LIVE registry (`validate()`: a `scanned_rejected` cap can never activate;
protected permissions re-scanned; every composition step must resolve to a real
tool NOT in `COMPOSITION_TOOL_DENYLIST`), then `registry.markActivated` (the ONE
method that writes `active`, refuses any non-activatable state) + registers a
`capability:<name>` gated tool. That tool executes the stored composition through
`loop.runTool` step-by-step (each re-gated; halts on the first denial); its risk
ceiling = max(declared, every step). `deactivate` unregisters + marks `disabled`;
`restoreActive()` re-registers active caps on boot (re-validating each).
Propose→approve→activate tools: `selfext.reviewQueue` (READ_ONLY discovery),
`selfext.propose` (LOW_REVERSIBLE — announce + agenda, heartbeat-safe, never
activates), `selfext.activate` (CONSEQUENTIAL — approving it IS the
authorization), `selfext.deactivate`, `selfext.listActive`. Routes
`/selfext/active|activate|deactivate` (activate/deactivate run through the gated
loop). **A heartbeat brain pass (ceiling LOW_REVERSIBLE) can PROPOSE but the
CONSEQUENTIAL activate is auto-DENIED — nothing self-activates.**

## Verified
- 2026-07-17: 14 selfext tests (every hard-limit rejection case + Stage-A
  never-activates). Live: a capability trying to modify core/policy.ts + request
  approval:bypass was REJECTED with named violations; a benign weather tool passed
  to `awaiting_review` without activating; audit chain intact.
- 2026-07-19: 9 activation tests (clean activate→live composed tool; rejected can
  never activate; denylist/unknown-tool/protected-permission refused at
  activation; halt-on-denied-step; deactivate + restoreActive; orphan skipped;
  propose LOW_REVERSIBLE / activate CONSEQUENTIAL). Live clean-slate real-brain:
  Stage-A→propose→approve→activate→run-composition; malicious REJECTED + never
  activatable; heartbeat can't self-activate. Record:
  `docs/verification/STAGE_B_AFFECT_2026-07-19.md`.

## Next (on the Mac / future hardening)
The isolated-worktree sandboxed GENERATOR (a subagent producing the manifest +
composition out-of-process) and dep/SBOM/license scans run on the M3 Max. Future
activation hardening: observe-first-executions with auto-rollback, signed/hashed
artifacts, capability versioning/upgrade. The activation contract here is stable;
these slot in behind it.
