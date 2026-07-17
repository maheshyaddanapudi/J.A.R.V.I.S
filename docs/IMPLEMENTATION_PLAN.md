# IMPLEMENTATION_PLAN — J.A.R.V.I.S. (living document)

**Status:** ACTIVE
**Last updated:** 2026-07-16 (Phase 0)
**Session-continuity rule (docs/07):** every session re-reads this file, `DECISION_LOG.md`, `CAPABILITY_PARITY_MATRIX.md`, and the relevant `CLAUDE.md` before doing anything, and resumes from **Current state** below.

---

## Current state

| Field | Value |
|---|---|
| **Current phase** | **Phase 0 — Research & Architecture** |
| **Current slice** | Phase 0 check-in in progress (2026-07-17): **architecture Option A APPROVED (D-0002); voice stack APPROVED with listening-demo condition (D-0004); parity matrix IN DISCUSSION (D-0003)** |
| **Production code written** | None (correct for Phase 0) |
| **Blocking decision** | DECISION_LOG D-0003 (parity matrix approval — user requested walkthrough/discussion) |
| **Next action after approval** | Begin Phase 1 slice 1.1 (repo scaffold + infra) per plan below |

### Phase 0 exit checklist
- [x] Binding docs read (`docs/01`–`docs/07`, README)
- [x] Repo inspected (docs-only repo; no existing code)
- [x] Spatial-platform input/privacy APIs verified with sources → `docs/RESEARCH_VERIFICATION.md`
- [x] OSS voice stack + core stack licenses verified → `docs/RESEARCH_VERIFICATION.md`
- [x] `docs/PRODUCT_SPEC.md` created
- [x] `docs/CAPABILITY_PARITY_MATRIX.md` created (five-state, sourced)
- [x] `docs/ARCHITECTURE.md` created (options A/B/C + recommendation)
- [x] `docs/THREAT_MODEL.md` created
- [x] `docs/IMPLEMENTATION_PLAN.md` (this file)
- [x] `docs/DECISION_LOG.md` created
- [x] `docs/REQUIREMENTS_TRACEABILITY.md` created
- [x] Root `CLAUDE.md` created (module-level CLAUDE.md files are created with their modules from Phase 1 on — surfaced at check-in)
- [ ] **Phase 0 check-in held; architecture + parity matrix approved** ← WAITING ON USER

---

## Phase roadmap (from docs/04; slices are complete vertical slices)

### Phase 1 — Functional Core (target after Phase 0 approval)
**Objective:** the end-to-end core loop: real voice in → real reasoning → real gated action → real voice out → cinematic display; fully local path proven.

Slices (each independently runnable and demoed):
1. **1.1 Scaffold & infra** — monorepo, Docker Compose (Postgres+pgvector), migrations, config system, OTel wiring, health checks, one-command dev startup. *Accept: `make dev` (or equivalent) brings up infra + kernel + UI skeleton with live health page (no fake data — health page shows real service states).*
2. **1.2 Model gateway** — neutral message/tool schema; Ollama + one cloud adapter; roles `fast_conversation`, `embeddings`, `local_fallback`; structured-output validation; cost/latency audit; privacy classes; offline mode flag. *Accept: same prompt served by both providers via config switch; offline mode passes with egress monitor showing zero outbound.*
3. **1.3 Voice pipeline** — wake word "Jarvis", VAD, streaming STT, streaming TTS, barge-in, push-to-talk, metrics. *Accept: docs/06 voice criteria + latency budget (PRODUCT_SPEC §2.4).*
4. **1.4 Kernel & core loop** — objective evaluation, decision policy, tool dispatch, activity timeline events, audit log (hash-chained), emergency stop. *Accept: e-stop halts everything <1 s from UI + orb + menu bar.*
5. **1.5 Approval flow & two Phase-1 tools** — risk classes, approval grammar, one read-only tool (e.g., system/file inspection), one reversible Mac action (e.g., create/rename a file or toggle a setting with captured undo plan). *Accept: approve one action, deny another; rollback demonstrated.*
6. **1.6 Conversation memory** — conversation store + one preference memory with view/correct/delete; restart persistence. *Accept: docs/06 memory criteria.*
7. **1.7 Command Center v1 + Voice Orb** — objective/execution/model/tool/approval/result views, timeline, audit view, memory panel, e-stop; design tokens per visual language; reduced-motion/high-contrast. *Accept: everything shown is live system data.*
8. **1.8 Packaging & verification** — packaged macOS companion (Tauri) + local web app; documented install/start commands; backup/restore; full Phase-1 acceptance run (all 14 criteria in docs/06), recorded results.

**Phase-1 acceptance tests:** the 14 user-facing criteria in `docs/06 §Phase 1` executed on the real machine and recorded (pass/fail + evidence) in `docs/verification/PHASE_1_ACCEPTANCE.md`.
**Check-ins inside Phase 1:** visual design system (before 1.7 hardens); **voice listening demo — Kokoro `bm_fable` vs `bm_george` + Kyutai alternates — before the voice identity is fixed in 1.3 (condition on D-0004)**; memory architecture + local security model (before 1.4/1.6).

### Phase 2 — Computer & Knowledge
Screen understanding (ScreenCaptureKit), Accessibility control (AXUIElement), browser automation (Playwright), files, terminal-with-policy, repo/document/image analysis, persistent encrypted memory (full store set), research with provenance, independent action verification. **Check-in before enabling computer control.** Hardware prereqs: none (webcam optional for B3).

### Phase 3 — Dynamic Agents & Self-Extension
Registries (agents/tools/skills/rules/prompts/workflows/models/devices/plugins/MCP/integrations/simulators/displays/sensors); dynamic sub-agent orchestration; **Stage A pipeline; DEDICATED SECURITY CHECK-IN; Stage B activation**; versioning + rollback; end-to-end demo (detect→…→roll back). Protected-path enforcement lands here (THREAT_MODEL T3).

### Phase 4 — Communications & Proactivity
Mail/calendar/messaging integrations (user-configured), Intelligence mode, briefings, commitment tracking, proactive gates. **Check-in before enabling proactive behavior.**

### Phase 5 — Home & Hardware
Home Assistant integration, device gateway, hardware catalog + plugin SDK, room model, Stark-residence simulator (labeled), real devices as configured. **Check-ins: physical-device control enable; any hardware purchase recommendation.**

### Phase 6 — Workshop & Spatial Scene Service
3D/CAD, digital twins, mouse+voice+webcam-gesture manipulation, multi-display, flat-screen 3D fallback, spatial persistence. **Check-in: camera/hand-tracker architecture.**

### Phase 7 — Quest & OpenXR clients. (Re-verify platform APIs first — R-SPA-03.)
### Phase 8 — Projection-mapped room. (Hardware selection check-in.)
### Phase 9 — Light-field & volumetric displays. (Hardware selection check-in.)
### Phase 10 — HUD & mission systems (+ armor/flight/robot/drone simulators; safe real-device plugins where owned).
### Phase 11 — Apple ecosystem (iPhone/Watch/Vision Pro; trusted local-network pairing; handoff). (Re-verify visionOS APIs.)
### Phase 12 — Complete spatial room.
### Phase 13 — Parity, hardening, optimization (full matrix audit; replace temporary adapters; security/prompt-injection/failure/recovery testing; backup/rollback validation; clean-install, offline, local-only, e-stop, hardware-failure verification).

---

## Approved decisions
- **D-0002 (2026-07-17): Architecture Option A** — Hybrid TS kernel + Python intelligence/speech + Tauri 2/Swift bridge + Next.js/R3F + Postgres/pgvector; includes D-0006/8/9/10/13/14.
- **D-0004 (2026-07-17): Voice stack approved with condition** — listening demo before voice identity hardens (slice 1.3).
- Full detail in `DECISION_LOG.md`.

## Deferred items (deferral ≠ removal; docs/05)
| Item | Reason | Prerequisites | Target phase | Resume criteria |
|---|---|---|---|---|
| Affect/emotion inference (matrix B4) | High error risk; consent design needed | Opt-in design; labeling UX | Revisit ≥ Phase 6 | User opts in at a check-in |
| Personal health telemetry (B5) | Needs wearable + HealthKit authorization | Apple Watch pairing; Phase 11 stack | 11 | Device configured |
| Module-level CLAUDE.md files | No modules exist in Phase 0 (docs-only repo) | Phase 1 scaffold | 1.1 | Created with each module |
| Multi-user support | Spec is single-user | — | Out of current scope | Explicit user request |

## Risks (top; full register grows per phase)
| Risk | Impact | Mitigation |
|---|---|---|
| Voice latency budget missed on-device | Core-loop feel broken | Measured budgets per slice 1.3; model-size fallback for `fast_conversation`; streaming everywhere |
| Barge-in/echo cancellation quality on open speakers | False barge or self-trigger | macOS voice-processing audio path evaluated in 1.3; headset mode documented fallback |
| LiteLLM supply-chain history (see RESEARCH_VERIFICATION) | Gateway compromise | Pin versions; use as library not proxy; consider thin in-house adapter layer per ARCHITECTURE option |
| Self-extension scope creep before Phase 3 gate | Safety | Pre-Phase-3 behavior rule (PRODUCT_SPEC §5.3); hard-limit paths structural |
| macOS TCC permission friction | Setup failure for control features | Documented permission setup + diagnostics in Phase 2 |
| User hardware inventory unknown (home devices, XR) | Phase 5/7 planning | Inventory captured at Phase 5/7 pre-check-ins; simulators first |

## Hardware prerequisites by phase
- P1–P4: none beyond the Mac (built-in mic/speakers; headset recommended for best barge-in).
- P5: Home Assistant-compatible devices (or simulator-only), optional webcam.
- P6: optional webcam for gesture; multi-display optional.
- P7: Quest 3/3S. P8: projector(s) + calibration camera. P9: light-field/volumetric display. P11: iPhone/Watch/Vision Pro. P12: room sensors/nodes.
- Every purchase recommendation goes through a check-in with current availability verification (R-HW-03).
