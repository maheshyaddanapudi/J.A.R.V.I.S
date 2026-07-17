# IMPLEMENTATION_PLAN — J.A.R.V.I.S. (living document)

**Status:** ACTIVE
**Last updated:** 2026-07-16 (Phase 0)
**Session-continuity rule (docs/07):** every session re-reads this file, `DECISION_LOG.md`, `CAPABILITY_PARITY_MATRIX.md`, and the relevant `CLAUDE.md` before doing anything, and resumes from **Current state** below.

---

## Current state

| Field | Value |
|---|---|
| **Current phase** | **Phase 1 — Functional Core** (Phase 0 completed 2026-07-17: D-0002 Option A approved; D-0003 matrix approved with amendments D-0018/19/20; D-0004 voice stack approved w/ listening-demo condition) |
| **Current slice** | **Phase-1 container-buildable core complete + safety-first FOUNDATIONS for Phases 2–6 built ahead (all SIMULATION/gated, none activated).** Phase 1: full local voice round-trip (`/voice-turn`: audio→sherpa-onnx STT→kernel gated loop→Kokoro TTS, verified end-to-end, AT1.12 offline path zero-egress), turn-taking/barge-in, AudioIO HAL (macOS VPIO Swift source). Foundations since (each built + live-verified in-container, each gated on its docs/06 check-in): **2** computer-control HAL SIMULATION (D-0022); **3** self-extension hard-limit + Stage-A generate-without-activate, no activation path (D-0023); **4** proactivity engine + full gate stack (D-0024); **5** device-control HAL Stark-residence SIMULATION + HIGH_RISK_PHYSICAL interlocks (D-0025); UI Ambient Voice Orb on real kernel state + design system (D-0026); field-level encryption-at-rest vault (D-0021/R-MEM-03). **NEW 2026-07-17:** **MCP client host (`kernel/src/mcp/`, R-CAP-02/D-0027)** — connects to a REAL stdio MCP server (SDK 1.29), discovers tools, registers them namespaced + trust-gated (untrusted→approval), rug-pull quarantine + name-shadow prevention verified live (T2); trust elevation is a per-server check-in. Also fixed a real build bug (migrations dir nesting on rebuild → only 3/6 migrations shipped in `dist`). **MCP registry persistence** (migration 0007): trust + manifest fingerprint + quarantine survive a kernel restart (rug pull caught even if it happened while down). **Managed secrets vault** (`crypto/secrets.ts`, migration 0008, R-MEM-06/D-0028): integration credentials encrypted at rest, value never over HTTP or in audit, MCP `secretEnv` resolves by name (fail-closed) — live-verified. Fixed a recurring test-harness bug (migrate test dropped shared `schema_migrations`). **Credential path unified:** gateway API keys, MCP server env, and the HA token all resolve from the encrypted SecretsVault (env fallback). **Contextual awareness** (`kernel/src/context/`, D-0029): a read-only `ContextService` folds time, commitments, pending approvals, proactive items, non-sensitive pinned memory, e-stop + MCP count into a labeled reference block injected into every conversation (Mac focused-app/screen providers plug into the same contract); `GET /context`. **118 kernel tests + 9 ears tests pass.** **Command Center operations dashboard** (`apps/command-center/app/page.tsx`): live view over the whole kernel — context, MCP servers (trust/quarantine), proactive, secrets (names only), audit-integrity, approvals, activity SSE, persistent e-stop; all real state, resilient partial loading; verified live via headless Chromium against a running kernel. **Full Command Center** now also has: interactive secret/MCP controls, a text conversation panel (`/chat`, real /core/converse SSE + memory + context), the proactivity transparency panel (`/proactive`), the computer-control approval preview (`/control`, SIMULATION), the device-control interlock preview (`/devices`, SIMULATION), and the self-extension Stage-A safety preview (`/selfext`, hard-limit rejection) — **all eight goal pillars now have a verified UI surface**. Also fixed a CORS-preflight bug that had been blocking every cross-origin write button. **Platform acceptance harness** (`scripts/acceptance_platform.py`): drives every subsystem end-to-end → **16 PASS (incl. offline mode) · 2 verified-elsewhere · 4 NEEDS-MAC · 0 FAIL** in-container (the NEEDS-MAC rows become real on the Mac). **Agent runtime** (`kernel/src/agent/`, D-0030): `LocalAgentRuntime` — multi-step plan-and-act loop (the core loop's "next action") over the gateway's native tool calling, every step executed through the gated `runTool` (approval + verify), step-budget bound, e-stop halts mid-plan; behind a replaceable `AgentRuntime` interface (LangGraph later). Route `POST /agent/run`. Verified: 5 unit tests (incl. denied-step-never-runs) + live multi-step run (model → `system.info` → gated exec → synthesized answer), audited. **Skills registry** (`kernel/src/skills/`, migration 0009, D-0031, R-CAP-01): saved named objectives run via the gated agent (no capability escalation); routes `/skills`. **Workspace knowledge/files** (`kernel/src/knowledge/`, D-0032, Phase-2 "files"): a **REAL** (not SIMULATION), workspace-scoped filesystem capability — `files.list`/`read`/`stat`/`search` (READ_ONLY, auto-run) + `files.edit` (CONSEQUENTIAL, reversible, independently re-read-verified); path-safe (no traversal/absolute escape), binary/oversize-refusing, bounded search; fully local/offline; the agent picks these up automatically. **148 kernel tests pass.** Live-verified end-to-end through the gated loop (two-step approval, on-disk verification, scope enforcement) + acceptance harness row `P-KNOW-01` (**17 PASS · 3 verified-elsewhere · 4 NEEDS-MAC · 0 FAIL**). **Mac-gated remainder:** live mic/speaker binding + VPIO echo-cancel, Tauri packaged app (AT1.1), expressive-voice identity pick (D-0004a), `make dev` Docker acceptance, and every real-adapter activation check-in (D-0022/23/24/25). |
| **Production code written** | 1.1: kernel core (config/db/migrations/health/journal), Command Center system page, infra. 1.2: gateway (neutral schema, ollama/anthropic/openai_compat adapters, router with privacy+offline+fallback+structured-output, model_calls audit, SSE routes) |
| **Blocking decision** | None. Upcoming in-phase check-ins: memory architecture + local security model (before 1.4/1.6); voice listening demo (before 1.3 hardens); visual design system (before 1.7 hardens) |
| **Development environment note** | Development happens in a Linux remote session; macOS-specific builds (Tauri companion, MLX speech, VPIO) are compiled/verified on the user's Mac via documented commands — every slice's acceptance run happens on the real machine (R-VER-04) |

### Phase 0 exit checklist ✅ COMPLETE 2026-07-17
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
- [x] **Phase 0 check-in held 2026-07-17; architecture (Option A) + parity matrix (with amendments D-0018/19/20) approved**

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
Screen understanding (ScreenCaptureKit), Accessibility control (AXUIElement), browser automation (Playwright), files, terminal-with-policy, repo/document/image analysis, persistent encrypted memory (full store set), research with provenance, independent action verification. **Check-in before enabling computer control (D-0022).** Hardware prereqs: none (webcam optional for B3).
- **Slice 2.1 foundation ✅ (2026-07-17, container-verified):** computer-control HAL — typed `ComputerControl` contract (`kernel/src/control/`), labeled SIMULATION adapter over a real virtual desktop (10 tests), 5 policy-gated control tools (READ_ONLY inspection auto-runs; CONSEQUENTIAL actions disclosed/approved/audited/verified) driven through the live gated loop (approve/deny/audit verified), semantic-first with flagged coordinate fallback. Real macOS adapter source (`MacDesktop.swift`, AXUIElement/CGEvent) written. **Real-adapter activation gated on the check-in (D-0022).**
- **Slice 2.2 files/knowledge ✅ (2026-07-17, container-verified, D-0032):** a **REAL** (not SIMULATION) workspace-scoped filesystem capability (`kernel/src/knowledge/`) — `files.list`/`read`/`stat`/`search` (READ_ONLY, auto-run) + `files.edit` (CONSEQUENTIAL, reversible, independently re-read-verified by the loop). Path-safe (no `..`/absolute escape; out-of-scope = clean pre-approval denial), binary/oversize-refusing, bounded search; fully local/offline; the agent runtime uses these automatically. 17 tests + live end-to-end + harness `P-KNOW-01`. Unlike control/devices this needs no Mac check-in — it's real in-container; on the Mac only the scoped root changes. Remaining Phase-2: screen understanding, **browser automation (Playwright)**, terminal-with-policy, research-with-provenance, full memory store set.

### Phase 3 — Dynamic Agents & Self-Extension
Registries (agents/tools/skills/rules/prompts/workflows/models/devices/plugins/MCP/integrations/simulators/displays/sensors); dynamic sub-agent orchestration; **Stage A pipeline; DEDICATED SECURITY CHECK-IN; Stage B activation**; versioning + rollback; end-to-end demo (detect→…→roll back). Protected-path enforcement lands here (THREAT_MODEL T3).

### Phase 4 — Communications & Proactivity
Mail/calendar/messaging integrations (user-configured), Intelligence mode, briefings, commitment tracking, proactive gates. **Check-in before enabling proactive behavior (D-0024).**
- **Proactivity engine foundation ✅ (2026-07-17, container-verified):** commitment/deadline/overdue tracking, calendar-conflict detection, daily briefing composition, and the full gate stack (per-domain enable, min priority, confidence threshold, quiet hours w/ critical-bypass, snooze/dismiss, dedup, rate limit) with a "why am I seeing this" per item and audited cycles (`kernel/src/proactive/`, 10 tests). Surfaces info only — never consequential without approval. **Live background delivery gated on the check-in.** Remaining Phase-4: mail/calendar/messaging integrations, Intelligence mode, background scheduler + notifications.

### Phase 5 — Home & Hardware
Home Assistant integration, device gateway, hardware catalog + plugin SDK, room model, Stark-residence simulator (labeled), real devices as configured. **Check-ins: physical-device control enable (D-0025); any hardware purchase recommendation.**
- **Device-control foundation ✅ (2026-07-17, container-verified):** device gateway HAL (`kernel/src/devices/`), Stark-residence SIMULATION adapter, policy-gated device tools, and the HIGH_RISK_PHYSICAL safety model — locks/garage/utilities require per-action approval PLUS a single-use hardware interlock (verified live: lock refused without interlock, succeeds with it, single-use enforced). Real Home Assistant adapter source written. 9 device tests. **Real gateway gated on the check-in.** Remaining Phase-5: real HA pairing, device registry, Matter/MQTT/Zigbee, room model, Home Control UI.

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
- **D-0004/D-0004a (2026-07-17): Voice stack approved with condition** — expressive-TTS listening test on the Mac before voice identity hardens; optional key-gated cloud TTS adapter added; Kokoro baseline preference George/Daniel.
- **D-0021 (2026-07-17): Memory architecture + local security model APPROVED** — slices 1.4/1.6 unblocked.
- Full detail in `DECISION_LOG.md`.

## Deferred items (deferral ≠ removal; docs/05)
| Item | Reason | Prerequisites | Target phase | Resume criteria |
|---|---|---|---|---|
| ~~Affect/emotion inference (B4)~~ | **Rescheduled 2026-07-17 (D-0019)** — now a planned opt-in capability | Prosody pipeline | 4 (voice) / 6 (camera) | — |
| Personal health telemetry (B5) | Needs HealthKit authorization + Phase 11 stack (Watch **owned**, D-0020) | iPhone/Watch pairing; Phase 11 stack | 11 | Phase 11 begins |
| Module-level CLAUDE.md files | No modules existed in Phase 0 | Phase 1 scaffold | 1.1 | Created with each module (in progress) |
| Multi-user support | Spec is single-user | — | Out of current scope | Explicit user request |
| visionOS native client | No Vision Pro owned (D-0020) | Device acquired (purchase = check-in) | 11 | Device available; APIs re-verified |

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
- P5: Home Assistant-compatible devices (**none owned** — simulator-first per D-0020), optional webcam.
- P6: optional webcam for gesture; multi-display optional.
- P7: Quest 3/3S — **Quest 3S owned (D-0020)**. P8: projector(s) + calibration camera (none owned). P9: light-field/volumetric display (none owned). P11: iPhone + Watch **owned**; Vision Pro **not owned** (deferred item). P12: room sensors/nodes (none owned).
- Every purchase recommendation goes through a check-in with current availability verification (R-HW-03).
