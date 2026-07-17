# REQUIREMENTS_TRACEABILITY — J.A.R.V.I.S.

**Status:** DRAFT — pending Phase 0 check-in approval · **Living document**, updated at every phase gate.
**Generated:** 2026-07-16 (Phase 0)

Every non-negotiable requirement from the binding docs (`docs/01`–`docs/07`) is enumerated with a stable ID and mapped to: product-spec section (`PRODUCT_SPEC.md`), parity-matrix entries (`CAPABILITY_PARITY_MATRIX.md`), implementing phase(s), acceptance tests, current status, and governing decisions (`DECISION_LOG.md`). **No requirement has been dropped.** Sequencing deferrals are marked and cross-referenced (docs/05 scope rule). Statuses: `SPEC` (specified, not yet built — correct for Phase 0), `PENDING-CHECKIN`, `BUILT`, `VERIFIED`.

Acceptance-test IDs: `AT1.x` = the 14 Phase-1 criteria in docs/06 (numbered in order); `ATn.*` = phase-n gate demos defined in IMPLEMENTATION_PLAN when that phase is planned in detail.

---

## Core & honesty (docs/01)

| ID | Requirement (source) | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-CORE-01 | Dual nature: genuine assistant AND cinematic experience (01 §Mission) | 1 | all | all | phase-gate demos | SPEC | — |
| R-CORE-02 | Honesty rule: real implementations; typed HAL + simulators for missing hardware; labeled SIMULATION adapters; never claim simulated is real (01 §Honesty) | 1.1, 14 | states themselves | all | CI invariant #8 (THREAT_MODEL §6); per-phase matrix audit | SPEC | — |
| R-CORE-03 | Core loop: wake→context→objective→decision→streamed response→gated execution→verify→record→next action; no chain-of-thought exposure; pre-P3 records capability gaps without claiming generation (01 §Core loop) | 1.2 | A1–A5, C2 | 1 | AT1.2–AT1.7, AT1.14 | SPEC | — |
| R-CORE-04 | Core loop runs fully locally incl. offline path before building outward (01) | 1.2, 3.4 | G7 | 1 | AT1.11, AT1.12 | SPEC | D-0012 |

## Voice (docs/02 §Voice)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-VOICE-01 | Local always-listening "Jarvis" wake word + push-to-talk + keyboard | 2.1 V1 | A4 | 1 | AT1.2 | SPEC | D-0004 |
| R-VOICE-02 | Streaming STT and streaming TTS | 2.1 V2 | A1 | 1 | AT1.4 | SPEC | D-0004 |
| R-VOICE-03 | Natural turn-taking + barge-in | 2.1 V3 | A5 | 1 | AT1.3 | SPEC | D-0004 |
| R-VOICE-04 | VAD, echo cancellation, noise suppression | 2.1 V4 | A5 | 1 | AT1.3 (implied) + latency budget | SPEC | D-0004 |
| R-VOICE-05 | Optional local speaker verification | 2.1 V5 | A6 | 1 (optional) | slice 1.3 tests | SPEC | D-0004 |
| R-VOICE-06 | Whisper/quiet modes | 2.1 V6 | A7 | 1 | slice 1.3 tests | SPEC | — |
| R-VOICE-07 | Configurable length/formality/urgency | 2.1 V7 | A1 | 1 | slice 1.4 tests | SPEC | — |
| R-VOICE-08 | Spoken approvals/warnings/summaries | 2.1 V8 | A8 | 1/4 | AT1.8 (visual+spoken path) | SPEC | — |
| R-VOICE-09 | Measured latency/false-wake/interruption/accuracy metrics | 2.1 V9 | I-telemetry | 1 | PRODUCT_SPEC §2.4 budget | SPEC | — |
| R-VOICE-10 | Offline voice fallback | 2.1 V10 | G7 | 1 | AT1.11–12 | SPEC | — |
| R-VOICE-11 | Distinct restrained British synthetic voice; NO actor cloning | 2.2 | A2, A3 | 1 | voice check-in | SPEC (stack approved 2026-07-17; identity fixed after listening demo) | D-0004 |
| R-VOICE-12 | Every voice engine replaceable OSS behind typed interface | 2.3 | — | 1 | contract review at gate | SPEC | D-0004 |

## Model gateway (docs/02 §Gateway)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-MODEL-01 | Separately routable roles (15 listed) | 3.1 | — | 1 (subset) → 2+ | slice 1.2 tests | SPEC | D-0008 |
| R-MODEL-02 | Providers: Anthropic/OpenAI-compat/Gemini/Ollama/custom; core decoupled from provider formats | 3.2 | — | 1 | provider-swap demo (§3.5) | SPEC | D-0008 |
| R-MODEL-03 | Discovery, structured-output validation, cost/latency tracking, privacy classification, fallback, pinning, per-agent policies | 3.3 | — | 1–2 | slice 1.2 tests | SPEC | D-0008 |
| R-MODEL-04 | Local-capable-first routing; no large-local mandate; fully offline when configured | 3.4 | G7 | 1 | AT1.11–12 | SPEC | D-0012 |

## Computer control (docs/02 §Computer control)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-CTRL-01 | Full macOS surface: capture, AX tree, windows/apps, mouse/keyboard, clipboard, launching, files, browser, terminal, AppleScript/JXA, Shortcuts via native bridges | 4.1 | C1–C3, B1 | 1 (2 tools) / 2 (full) | AT1.6, AT1.7; AT2.* | SPEC | D-0015 |
| R-CTRL-02 | Semantic-first; coordinates only as logged fallback | 4.2 | C2 | 2 | AT2.* | SPEC | D-0015 |
| R-CTRL-03 | Actions observable/interruptible/logged/permission-scoped/verifiable/reversible-where-possible | 4.3 | C2 | 1→ | AT1.7, AT1.13, AT1.14 | SPEC | — |
| R-CTRL-04 | Pre-action disclosure (what/affected/commands/reason/risk/reversibility/rollback/approval) | 4.3 | C2 | 1 | AT1.7 | SPEC | — |

## Capability platform & self-extension (docs/02 §Dynamic capability)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-CAP-01 | No fixed connector list; registries for 14 entity kinds | 5.1 | G1, G6 | 3 | AT3.* | SPEC | — |
| R-CAP-02 | MCP primary protocol + adapter families (CLI/HTTP/OpenAPI/GraphQL/WS/DB/FS/HA/MQTT/Matter/…/ROS 2) | 5.2 | G6, E1 | 3/5 | AT3.*, AT5.* | **BUILT+VERIFIED 2026-07-17 (MCP)** — MCP client host (`mcp/`) discovers a REAL stdio server (SDK 1.29), registers tools namespaced + trust-gated (untrusted→CONSEQUENTIAL), rug-pull quarantine + name-shadow prevention live (T2); other adapter families remain SPEC | D-0011, D-0027 |
| R-CAP-03 | Discover MCP/OpenAPI/CLI; generate typed integrations, tools, skills, rules, agents, workflows, plugins, simulators, tests, docs, schemas, manifests; diagnose/repair/version/rollback | 5.2–5.3 | G2, G6 | 3 | AT3.* end-to-end demo | SPEC | — |
| R-CAP-04 | Stage A: generation without activation (full pipeline incl. scans, sandbox, report) | 5.3 | G2 | 3 | AT3.* | SPEC | — |
| R-CAP-05 | Dedicated security check-in before any activation path; again per high-risk capability | 5.3 | G2 | 3 gate | check-in record | SPEC | — |
| R-CAP-06 | Stage B: controlled activation (approval, signed/hashed artifact, min permissions, observe, verify, provenance, auto-rollback) | 5.3 | G2 | 3 | AT3.* | SPEC | — |
| R-CAP-07 | Hot-reload only where proven safe; never activation-by-tests-alone | 5.3 | G2 | 3 | AT3.* | SPEC | — |
| R-CAP-08 | HARD LIMIT: generated capabilities never touch security/approval/audit/e-stop/credential/sandbox/escalation/installer logic — enforced structurally | 5.3 | G3 | 3 (design from 1) | CI invariant #1; install-time diff scan test | SPEC | — |
| R-CAP-09 | Pre-P3: record capability gaps; never claim generation ability | 5.3 | G2 | 1–2 | kernel behavior test | SPEC | — |

## Autonomy & approval (docs/02 §Autonomy)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-AUTO-01 | Risk-tiered default policy (read-only auto; low-reversible only when delegated; consequential requires approval; high-risk physical = per-action + interlocks); every tool call risk-classified | 6.1 | C2, E2, F4 | 1 | AT1.7, AT1.8 | SPEC | — |
| R-AUTO-02 | Approval grammar: allow-once/for-task/for-session/always-in-scope/deny/revoke/pause/cancel/e-stop | 6.2 | — | 1 | AT1.8 | SPEC | — |
| R-AUTO-03 | Persistent emergency stop in every major interface | 6.2 | I3 | 1→ | AT1.14; invariant #4 | SPEC | — |
| R-AUTO-04 | Prohibited list (10 items), non-negotiable, policy-layer hard deny | 6.3, 16 | J (all PROHIBITED rows) | 1→ | THREAT_MODEL §5 tests | SPEC | D-0003 |

## Memory (docs/02 §Memory)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-MEM-01 | 24 distinct typed stores | 7.1 | H1–H4 | 1 (conversation+prefs) / 2 (full) | AT1.9; AT2.* | SPEC | — |
| R-MEM-02 | Postgres + pgvector; no proprietary hosted vector DBs | 7.2 | H1 | 1 | infra review | SPEC | D-0013 |
| R-MEM-03 | Provenance, confidence, dates, expiration, retention, sensitivity; encryption at rest + field-level | 7.2 | H1 | 1–2 | schema review; invariant #3 | **BUILT+VERIFIED 2026-07-17** — field-level AES-256-GCM vault (`crypto/`); private/secret prefs + conversation content ciphertext at rest (DB grep = 0 plaintext), KEK from Keychain/env, wrong-key fatal, survives restart | D-0013 |
| R-MEM-04 | Search/view/correct/pin/forget/export/delete/reset/backup/restore-verified/dedup | 7.3 | H2 | 1 (view/correct/delete) / 2 (full) | AT1.10 | SPEC | — |
| R-MEM-05 | Epistemic status enum (9 states) distinguished everywhere | 7.2 | H2, B4 | 1→ | schema + retrieval tests | SPEC | — |
| R-MEM-06 | No secrets in conversational memory; Keychain/encrypted vault | 7.4 | — | 1 | invariant #3 | SPEC | D-0013 |

## Proactive behavior (docs/02 §Proactive)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-PRO-01 | Briefings, meeting prep, conflict detection, comms surfacing, commitments, long-running continuation, monitoring, anomalies, next actions | 8 | A8, A9, C6, C8 | 4 | AT4.* | SPEC | — |
| R-PRO-02 | Gates: quiet hours, priority, confidence, dedup, escalation, per-domain permissions, rate limits, snooze, explanations; sparse | 8 | A8 | 4 | AT4.* | SPEC | — |
| R-PRO-03 | Never consequential action without approval | 8 | — | 4 | policy tests | SPEC | — |

## Interface (docs/02 §Cinematic)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-UI-01 | Functional Stark visual language WITHOUT Marvel IP/actor likeness/production assets | 9.1 | I1, I2 | 1→ | design check-in | **PROPOSED for check-in** (`docs/DESIGN_SYSTEM.md`, D-0026); CC + Voice Orb built on it | D-0026 |
| R-UI-02 | Color semantics, motion-communicates-state, accessibility (reduced-motion/high-contrast/scalable type) | 9.1 | I1 | 1→ | AT1.5 + a11y check | SPEC | — |
| R-UI-03 | No decoration: no fake code/random telemetry/meaningless charts | 9.1 | I1 | all | phase-gate review | SPEC | — |
| R-UI-04 | 10 interface modes as real vertical slices (live data or labeled simulator, never empty) | 9.2 | I1–I5, F1 | per-mode phases | per-mode DoD §9.2 | SPEC | — |
| R-UI-05 | Health/Telemetry: authorized data only; no medical diagnosis; inferred health never presented as fact | 9.2 | B5 | 1 (system) / 11 (personal) | mode DoD | SPEC | — |

## Five-state classification (docs/02 §Five-state)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-CLASS-01 | Living five-state matrix, every capability exactly one state, sourced | 14 | whole doc | 0→ | matrix exists; check-in | **VERIFIED (approved 2026-07-17)** | D-0003, D-0018/19/20 |
| R-CLASS-02 | Simulation modules permanently display SIMULATION; never confusable with live | 14 | D7, F4–F7 | 1→ | invariant #8 | SPEC | — |
| R-CLASS-03 | No capability disappears without explanation | 14 | change control | all | matrix change log | SPEC | — |

## Spatial (docs/03)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-SPA-01 | Quest 3S/3, AVP, OpenXR, WebXR first-class targets; OpenXR primary abstraction; AVP not sole target | 10.1 | G7, I5 | 6–12 | ATn.* | SPEC | D-0016 |
| R-SPA-02 | Hardware-neutral Spatial Scene Service; same object renderable on 10+ display paths; runtime capability query + graceful degradation | 10.2 | D1, D3 | 6 | AT6.* | SPEC | — |
| R-SPA-03 | Verify official input/privacy APIs in Phase 0 and before each spatial phase; no raw-gaze dependence on AVP; raw gaze only via current official API + documented constraints + approval | 10.3 | I5 | 0 ✅, re-verify 6/7/11 | RESEARCH_VERIFICATION §1 | **VERIFIED (Phase 0 pass)** | D-0016 |
| R-SPA-04 | Honest display classification; never claim empty-air holography from conventional hardware | 10.4 | D1, D2 | 6–9 | plugin review | SPEC | — |
| R-SPA-05 | Projection/light-field/volumetric = future adapters: contracts + stubs + simulators now, implement when hardware selected | 10.4 | D1 | 8–9 | ATn.* | SPEC | — |

## Hardware catalog (docs/03)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-HW-01 | Living researched catalog + plugin marketplace; named products don't define architecture | 11 | D8, E1 | 5→ | AT5.* | SPEC | — |
| R-HW-02 | Per-product fields incl. LAST VERIFICATION DATE; no unverified claims | 11 | — | 5→ | catalog review | SPEC | — |
| R-HW-03 | Never purchase automatically; purchases are check-ins | 11 | — | all | policy test | SPEC | — |

## Open-source constraints (docs/03)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-OSS-01 | All server-side services, frameworks, stores, orchestration OSS; no proprietary hosted infra | 12/13 | — | all | dependency audit + SBOM | SPEC | D-0007, D-0010 |
| R-OSS-02 | Proprietary OS/hardware SDKs only for selected hardware, adapter-isolated, registered, open alternative documented, graceful failure | 12 | — | all | proprietary-adapter registry | SPEC | D-0015, D-0016 |
| R-OSS-03 | Flag GPL/AGPL/NC deps; prefer MIT/Apache; copyleft/NC surfaced at check-in first | 12 | — | all | license scan CI | SPEC | D-0004 (piper flag), D-0010 |

## Security (docs/05)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-SEC-01 | All external content potentially hostile | 12 | — | 1→ | THREAT_MODEL T1/T2 tests | SPEC | — |
| R-SEC-02 | Control catalog (least privilege … privacy indicators; 25+ controls) | 12 | — | phased | THREAT_MODEL §4 mapping | SPEC | — |
| R-SEC-03 | Audit logs, tamper detection, kill switches | 12 | G4 | 1 | AT1.13; invariant #2/#4 | SPEC | — |
| R-SEC-04 | Rate/delegation/resource limits; approval gates; security review; post-action verification; interlocks | 12 | — | 1→ | phase tests | SPEC | — |
| R-SEC-05 | Camera/mic/recording privacy indicators | 12 | B2 | 1 (mic) → | UI review | SPEC | — |
| R-SEC-06 | Blast radius: one compromised component never grants access to another tool/account/domain | 12 | — | 1→ | scope-isolation tests | SPEC | — |

## Scope & locality (docs/05)

| ID | Requirement | Spec § | Parity | Phase | Acceptance | Status | Decisions |
|---|---|---|---|---|---|---|---|
| R-SCOPE-01 | No permanent removal for session-size reasons; verified vertical slices; recorded deferrals with prerequisites/target/criteria | 15 | change control | all | IMPLEMENTATION_PLAN deferred table | SPEC | D-0005 |
| R-LOC-01 | All services/orchestration/memory/credentials/audit/generated code/device state/user data local | 13 | — | all | egress monitor; invariant #5 | SPEC | — |
| R-LOC-02 | Outbound only to explicitly configured integrations; each identifiable/scoped/observable/disableable/documented | 13 | — | 1→ | outbound-integration registry test | SPEC | — |
| R-LOC-03 | Nothing uploaded for hosting/convenience; no cloud deploy (no Vercel etc.) | 13 | — | all | phase-gate review | SPEC | — |

## Check-ins, verification, delivery (docs/06)

| ID | Requirement | Spec § | Phase | Acceptance | Status |
|---|---|---|---|---|---|
| R-VER-01 | Check-in triggers list (pre-code, self-extension, design system, voice/agent/memory/security stacks, control/proactive/device enables, installs, purchases, XR/hardware architecture, non-OSS deps, architecture changes, deferrals) | 15 | all | check-in records in DECISION_LOG | SPEC (this doc set = first check-in) |
| R-VER-02 | Per-phase: objective, demos, decisions, build, tests, demonstrate, record limitations, update docs | 15 | all | phase-gate checklist | SPEC |
| R-VER-03 | Delivery: one-command startup, Compose, native builds, packaged app, migrations, seeds, backup/restore/uninstall, diagnostics, health, logs, license inventory, SBOM | 15 | 1→ | slice 1.1/1.8 | SPEC |
| R-VER-04 | Launch & verify the real built system after each phase; never UI-renders = done | 15 | all | phase acceptance runs | SPEC |
| R-VER-05 | Phase-1 acceptance = the 14 criteria (AT1.1–AT1.14) | 15 | 1 | docs/verification/PHASE_1_ACCEPTANCE.md | SPEC |
| R-VER-06 | No pulling later-phase capabilities into Phase 1 | 15 | 1 | plan review | SPEC |

## Session continuity (docs/07)

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-CONT-01 | Every session: re-read plan/log/matrix/CLAUDE.md; resume in place; no re-deciding | all | ACTIVE (D-0017) |
| R-CONT-02 | DECISION_LOG binding unless reopened | all | ACTIVE |
| R-CONT-03 | End of session/phase: update plan, log, matrix, traceability, CLAUDE.md | all | ACTIVE |
| R-CONT-04 | Conflicts surfaced at check-ins, never silent divergence | all | ACTIVE |

---

## Phase-1 acceptance test index (AT1.1–AT1.14 ↔ docs/06)

AT1.1 install & start via documented commands · AT1.2 "Jarvis"/push-to-talk · AT1.3 natural interruption · AT1.4 streamed spoken+visual answer · AT1.5 Command Center shows objective/state/model/tools/approval/result · AT1.6 one real read-only tool · AT1.7 reversible Mac action with disclosure · AT1.8 approve one action, deny another · AT1.9 remember a preference · AT1.10 view/correct/delete that memory · AT1.11 restart retains approved memory · AT1.12 local-only + offline workflow (Ollama/local STT/TTS/embeddings; providers disconnected) · AT1.13 review complete audit trail · AT1.14 emergency stop halts execution.

### Verification status as of 2026-07-17 (container; ✅=verified here, 🖥=needs Mac, ◻=not yet)
- ✅ **AT1.6** read-only tool (system.info, live host state) — slice 1.4
- ✅ **AT1.7** reversible action + disclosure + rollback (workspace.writeNote) — slice 1.4
- ✅ **AT1.8** approve one / deny another (broker + UI button) — slice 1.4
- ✅ **AT1.9** remember a preference (memory.remember via loop) — slice 1.6
- ✅ **AT1.10** view/correct/delete memory (routes + CC panel) — slice 1.6
- ✅ **AT1.11** restart retains memory (verified across kernel restart) — slice 1.6
- ✅ **AT1.13** review complete audit trail (hash-chained, integrity-checked) — slice 1.4
- ✅ **AT1.14** emergency stop halts execution (tools + conversation) — slice 1.4
- ✅ **AT1.4 (partial)** streamed *visual* answer + text streaming through the loop from a real local model — slices 1.2/1.4; spoken half is 🖥
- 🟡 **AT1.5** Command Center shows objective/state/tools/approval/result/audit/memory/e-stop — built & browser-verified; "selected model" display polish pending 1.7
- ✅ **AT1.4 (spoken half — pipeline)** streamed *spoken* answer: full voice round-trip verified in-container (real STT → gated loop → real TTS audio out); needs Mac audio *device* for live playback — slice 1.3 part 2
- 🟡 **AT1.2** wake word / push-to-talk: wake engine verified on synthesized audio; live-mic capture needs the Mac (CoreAudio)
- 🟡 **AT1.3** natural interruption (barge-in): turn-taking/barge-in state machine built + tested; needs VPIO echo-cancel (or a headset) on the Mac for the live acoustic path
- ✅ **AT1.12** full offline workflow: verified — voice-turn ran with JARVIS_OFFLINE=1, remote provider disabled, wake/STT/TTS/model all local, **zero external network connections** (checked /proc/net/tcp). Live-audio device binding on the Mac is the only remaining piece.
- 🖥 **AT1.1** documented install/start of the packaged app — needs Tauri build on Mac
The voice pipeline (wake, VAD, streaming STT, TTS, turn-taking, and the full
audio→STT→reason→TTS round-trip) is now REAL and verified in-container. The
Mac-gated remainder is narrowed to: live mic/speaker device I/O, VPIO echo
cancellation, the packaged app, expressive-voice identity pick, and real-audio
latency metrics.

## Omissions surfaced at the Phase 0 check-in (none dropped) — check-in held 2026-07-17

1. **Module-level CLAUDE.md files** — deferred to Phase 1 slice 1.1 (D-0005) — accepted; now being created with modules.
2. **Affect/emotion inference (B4)** — was DEFERRED; user rescheduled it as a constrained opt-in capability, P4/P6 (D-0019).
3. **Personal health telemetry (B5)** — HARDWARE-DEPENDENT, Phase 11 — accepted (Watch owned, D-0020).
4. Everything else in the binding docs is mapped above with no exclusions. Phase 0 check-in outcome: architecture Option A, matrix approved with amendments, voice stack approved with demo condition.
