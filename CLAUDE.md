# CLAUDE.md — J.A.R.V.I.S. repository guide

This repo builds **J.A.R.V.I.S.** — a real, working, local-first personal AI OS for macOS with functional + experiential parity to the MCU J.A.R.V.I.S. It is a long-lived platform, not a demo.

## Resume protocol (do this FIRST, every session)

1. Read `docs/IMPLEMENTATION_PLAN.md` → **Current state** table tells you the current phase, current slice, and blocking decisions.
2. Read `docs/DECISION_LOG.md` — **binding** unless the user explicitly reopens a decision at a check-in.
3. Read `docs/CAPABILITY_PARITY_MATRIX.md` (states may have changed).
4. Read the module `CLAUDE.md` of any package you touch (created with each module from Phase 1 on).
5. Resume in place. Do NOT restart, re-scaffold, or re-propose approved decisions. Surface conflicts at a check-in instead of silently diverging.
6. At session end: update `IMPLEMENTATION_PLAN.md` (phase/slice/done/next), `DECISION_LOG.md`, the parity matrix, `REQUIREMENTS_TRACEABILITY.md`, and CLAUDE.md files.

## Authority & precedence

- **Binding authored docs** (win over everything generated): `docs/01 Mission And Core Loop.md`, `docs/02 Requirements.md`, `docs/03 Spatial Hardware OSS.md`, `docs/04 Stack and Phases.md`, `docs/05 Security Scope Locality.md`, `docs/06 Check-ins and Verify.md`, `docs/07 Session Continuity.md`. (Note: goal text refers to these with underscore names, e.g. `01_MISSION_AND_CORE_LOOP.md` — same files.)
- **Generated working docs**: `docs/PRODUCT_SPEC.md`, `docs/CAPABILITY_PARITY_MATRIX.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISION_LOG.md`, `docs/REQUIREMENTS_TRACEABILITY.md`, `docs/RESEARCH_VERIFICATION.md` (sourced verification, 2026-07-16).
- Requirement IDs (`R-…`) are defined in `REQUIREMENTS_TRACEABILITY.md`.

## Non-negotiable rules (bind every keystroke)

1. **Honesty rule:** achievable capabilities are implemented for real — never mock data, fake output, decorative screens, or simulated tool execution. Unavailable/fictional/unsafe capabilities use clearly-marked SIMULATION adapters behind the same typed contract, never presented as live.
2. **No production code before the Phase 0 check-in approves the architecture and parity matrix.** (Status lives in IMPLEMENTATION_PLAN.)
3. **Local-first:** persistent data, credentials, audit, generated code stay local. Outbound calls only to user-configured integrations. No cloud deploys. Full offline path must keep working.
4. **Every consequential action requires approval.** Persistent emergency stop in every interface. The prohibited list (R-AUTO-04) is hard-coded, deny-first.
5. **Self-extension** (Phase 3) is two-stage: Stage A generates without activating; a dedicated security check-in precedes any Stage B activation; generated capabilities may NEVER touch security/approval/audit/e-stop/credential/sandbox/installer logic (protected paths, structurally enforced).
6. **Check in** at every gate listed in `docs/06` — before design-system finalization, voice/agent/memory/security stack selection, enabling computer control/proactivity/device control, capability installs, hardware purchases, XR architecture, any non-OSS dependency, architecture changes, or any deferral.
7. **Five-state matrix discipline:** every capability is REAL / HARDWARE-DEPENDENT / SIMULATED / DEFERRED / PROHIBITED; changes are logged; nothing disappears silently.
8. **OSS constraints:** core must be open source; proprietary OS/hardware APIs only behind replaceable, registered adapters; flag GPL/AGPL/NC dependencies at a check-in before adopting.
9. **Verification:** never declare a feature complete because UI renders — run the real system; each phase ends with a real end-to-end acceptance run recorded under `docs/verification/`.

## Approved architecture

**None yet.** Options A/B/C are in `docs/ARCHITECTURE.md`; selection pending at the Phase 0 check-in (D-0002). After approval, record the choice in DECISION_LOG, update this section (option, process inventory, conventions), and scaffold per IMPLEMENTATION_PLAN slice 1.1.

## Conventions (extend after architecture approval)

- Target machine: MacBook Pro M3 Max, 128 GB, macOS 26 Tahoe (verified 2026-07-16), single user.
- Dates in docs: ISO `YYYY-MM-DD`. Every externally-verified claim carries a verification date; re-verify before the phase that depends on it.
- Requirement/decision cross-references: `R-XXX-nn` / `D-nnnn`.
- Branch: work happens on `claude/jarvis-local-ai-os-4smuhd` unless the user directs otherwise.
