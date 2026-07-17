# kernel/src/selfext — self-extension (Phase 3 foundation)

The HIGHEST-RISK subsystem (docs/02 §Dynamic capability). Built safety-first:
the **hard limit** and **Stage A generate-without-activate** exist; **there is no
activation path**, and none is built until the dedicated security check-in
(D-0023, R-CAP-05).

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

Registry states `installed`/`active` are defined in the schema but the code has
NO path to set them — that path is built only after the check-in.

## Verified (2026-07-17)
14 selfext tests (every hard-limit rejection case + Stage-A never-activates).
Live: a capability trying to modify core/policy.ts + request approval:bypass was
REJECTED with named violations; a benign weather tool passed to `awaiting_review`
without activating; audit chain intact.

## Next (needs the dedicated security check-in, D-0023)
Only after the check-in: the isolated-worktree sandboxed generator (subagent),
dep/SBOM/license scans, Stage B controlled activation (signed/hashed artifact,
min-permission install, observe first executions, auto-rollback), versioning.
On the Mac, generation runs out-of-process in an isolated git worktree.
