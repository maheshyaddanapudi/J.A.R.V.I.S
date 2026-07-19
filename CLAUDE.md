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
8a. **Dual-editability principle (D-0053, binding):** every configurable value must become editable by the user (UI + instructing J.A.R.V.I.S.) AND adjustable by J.A.R.V.I.S., with an override ledger (who/why/when) and the D-0052 evidence contract: a user-set value is respected by default and changed only when the trail since the pin clears a higher, re-pin-scaled bar — announced either way. Z1 protected paths (policy/approval/audit/e-stop/credentials/sandbox) are permanently excluded (R-CAP-08). New knobs land compliant; old ones migrate as touched.
9. **Verification:** never declare a feature complete because UI renders — run the real system; each phase ends with a real end-to-end acceptance run recorded under `docs/verification/`.

## Approved architecture

**Option A — Hybrid (approved 2026-07-17, D-0002):** TypeScript kernel `jarvisd` (trust core Z1: policy/approval/audit/credentials/e-stop + registries + model-gateway adapters + client transport) · Python `jarvis-mind` (LangGraph 1.x behind our `AgentRuntime` interface) · Python `jarvis-ears` speech daemon (sherpa-onnx KWS, Silero VAD, Kyutai-MLX STT, Kokoro TTS) · Tauri 2 companion with minimal Swift bridge (AX, CGEvent, ScreenCaptureKit, Shortcuts, Keychain, Voice Processing I/O) · Next.js 16 + React 19 + R3F Command Center · Postgres 18 + pgvector · Ollama · OTel → Jaeger v2. Valkey deferred until needed (D-0006). Details: `docs/ARCHITECTURE.md §3`.

**Parity matrix APPROVED 2026-07-17 (D-0003)** with amendments: full-suite simulators (D-0018), affect inference scheduled opt-in P4/P6 (D-0019), hardware inventory Quest 3S + Watch + iPhone (D-0020). Voice identity is not fixed until the listening demo (D-0004 condition).

## Build state (2026-07-18) — see `docs/IMPLEMENTATION_PLAN.md` → Current state for the live table
The container-buildable platform is **complete and continuously verifiable**:
`scripts/acceptance_platform.py` → **32 PASS · 3 verified-elsewhere · 4 NEEDS-MAC · 0 FAIL** (record: `docs/verification/PLATFORM_ACCEPTANCE.md`). All eight goal pillars have a real, verified surface: voice pipeline (offline round-trip), contextual awareness (`context/`), proactive behavior (`proactive/`, gated), cinematic UI (full Command Center + Voice Orb), macOS computer control (SIMULATION + real adapter, gated D-0022), device control (SIMULATION + HA adapter, gated D-0025), local encrypted memory + secrets vault, controlled self-extension (Stage-A hard limit). Plus the model gateway (pinned to the current Anthropic API — per-target `effort`/adaptive `thinking` as config, D-0046; observable via `/gateway/calls` + the `/models` panel, D-0047), **deep-reasoning escalation** (J.A.R.V.I.S. routes a hard turn to the `deep_reasoning` role, explained + overridable, provider-agnostic, D-0048; **learns** the user's deep topics from instruction + repeated correction, stored as visible/deletable preferences, D-0050), **provider-agnostic generation settings** (neutral `effort`/`thinking` translated per provider in the adapters; `JARVIS_EFFORT`/`JARVIS_THINKING`/`JARVIS_ROLE_<ROLE>` env controls, D-0049), **sleep-cycle consolidation** (J.A.R.V.I.S. journals its own routing decisions and consolidates them like a nightly reflection — bounded self-adjustment, proposals for the rest, user pin respected until the trail outweighs it, D-0051/D-0052), **runtime gateway role editor** (live re-route with ledger, `/models` panel + `PUT /gateway/roles/:role`, D-0054), **general runtime settings** (edit any catalogued knob live — effective = override-else-default, ledgered, Z1-excluded; `/settings` panel + gated `settings.set`/`reset`, D-0058), **background autonomy** (bounded scheduler runs the safe cycles — proactivity + sleep-cycle — on a persisted, runtime-editable schedule; default-off, e-stop-halts, never acts consequentially without approval; D-0024 approved), **durable consent** (`always-allow-in-scope` grants persist across restart, listable/revocable, D-0059), MCP host, the **agent runtime** (multi-step plan-and-act through the gated loop, `agent/`), and **memory-evolution completeness** (agent-owned `memory.correct`/`forget` with read-then-write factId precision, near-duplicate settings guard, `settings.list`, A2UI cascade-prune — D-0062). 302 kernel + 9 ears tests pass. **The 4 NEEDS-MAC rows** (live voice I/O, packaged Tauri app, real macOS control, real Home Assistant) require the physical M3 Max + their activation gates — run `docs/MAC_BRINGUP.md` on the Mac. Pending check-ins: D-0004a, D-0022, D-0024, D-0025, D-0026, D-0027, D-0023.

## Conventions (extend after architecture approval)

- Target machine: MacBook Pro M3 Max, 128 GB, macOS 26 Tahoe (verified 2026-07-16), single user.
- Dates in docs: ISO `YYYY-MM-DD`. Every externally-verified claim carries a verification date; re-verify before the phase that depends on it.
- Requirement/decision cross-references: `R-XXX-nn` / `D-nnnn`.
- Branch: work happens on `claude/jarvis-local-ai-os-4smuhd` unless the user directs otherwise.
