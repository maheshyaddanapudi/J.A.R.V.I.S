# DECISION_LOG — J.A.R.V.I.S.

**Rule (docs/07):** this log is **binding** unless the user explicitly reopens a decision at a check-in. Every entry: ID, date, status (`PROPOSED` → `APPROVED` / `REJECTED` / `SUPERSEDED`), decision, rationale, alternatives considered.

Statuses below marked PROPOSED are **awaiting the Phase 0 check-in** — nothing is treated as approved until the user says so.

---

## D-0001 — Phase 0 document set & file naming
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Generated docs use the exact names from the goal (`docs/PRODUCT_SPEC.md`, `docs/CAPABILITY_PARITY_MATRIX.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISION_LOG.md`, `docs/REQUIREMENTS_TRACEABILITY.md`), plus a supporting `docs/RESEARCH_VERIFICATION.md` holding the sourced 2026-07-16 platform/license verification. The authored binding docs exist on disk with spaces in their filenames (`docs/01 Mission And Core Loop.md` etc.) while the goal text references underscore names (`docs/01_MISSION_AND_CORE_LOOP.md`); we treat them as the same documents and do not rename user-authored files.
- **Rationale:** Keep the user's files untouched; keep generated names exactly as the goal specifies.

## D-0002 — Architecture option
- **Date:** 2026-07-16 · **Status:** PROPOSED — **user selection required at Phase 0 check-in**
- **Decision requested:** choose Option A (Hybrid TS+Python modular monolith — recommended), Option B (TypeScript-only core), or Option C (Swift-native core). Full tradeoffs in `docs/ARCHITECTURE.md`.
- **Recommendation:** Option A, per `docs/ARCHITECTURE.md §7`.

## D-0003 — Capability parity matrix approval
- **Date:** 2026-07-16 · **Status:** PROPOSED — **user approval required at Phase 0 check-in**
- **Decision requested:** approve `docs/CAPABILITY_PARITY_MATRIX.md` classifications, notably: the PROHIBITED rows (weapons targeting F2, unauthorized access C5, actor-voice cloning A3, Marvel IP I2, empty-air holography claims D2, covert persistence G4b, core self-modification G3), the SIMULATED rows (armor/flight/threat-assessment F4–F7, element synthesis D7), and the DEFERRED rows (affect inference B4, personal health telemetry B5).

## D-0004 — Voice stack picks
- **Date:** 2026-07-16 · **Status:** PROPOSED — final selection at the voice-stack check-in before Phase 1 slice 1.3
- **Decision requested:** approve the recommended picks in `docs/ARCHITECTURE.md §6` (wake word, STT, TTS + British voice, VAD, echo path, speaker verification), all open-source and locally runnable.

## D-0005 — Module-level CLAUDE.md files deferred to Phase 1
- **Date:** 2026-07-16 · **Status:** PROPOSED (surfaced per the "no requirement dropped silently" rule)
- **Decision:** Root `CLAUDE.md` is created in Phase 0. Module-level `CLAUDE.md` files are created **with each module** starting at Phase 1 slice 1.1, since the Phase 0 repo contains no code modules. This is a sequencing deferral, not a removal.

## D-0006 — Valkey deferred until a real queue/cache need exists
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Do not run Valkey in Phase 1. Postgres (LISTEN/NOTIFY + tables) covers Phase-1 eventing/persistence. Valkey (BSD-3-Clause, v9.1.0 verified 2026-07-16) is introduced when a measured need appears (expected: Phase 4 proactivity queues).
- **Rationale:** docs/04: "Justify every process and datastore; add nothing because it's fashionable."

## D-0007 — Valkey over Redis (when needed)
- **Date:** 2026-07-16 · **Status:** BOUND by authored docs (docs/04 names Valkey explicitly)
- **Note:** Verification 2026-07-16 confirms the reasoning: Redis ≥ 8.0 is tri-licensed RSALv2/SSPLv1/AGPLv3 (only AGPL is OSI, and it's strong copyleft); Valkey is BSD-3-Clause under the Linux Foundation.

## D-0008 — Model gateway approach: thin in-house gateway; LiteLLM optional adapter, pinned
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Build our own thin provider-adapter layer implementing the neutral message/tool schema (R-MODEL-02), with adapters for Anthropic, OpenAI-compatible, Gemini, and Ollama. LiteLLM (MIT core; enterprise-folder carve-out) may be used as an *optional, version-pinned* adapter backend but is not a hard dependency of the core.
- **Rationale:** Verified 2026-07-16: LiteLLM has a significant CVE history and a March 2026 supply-chain incident; the binding requirement is provider-neutral core logic, which our own boundary satisfies; four adapters are small compared to the risk surface of a large dependency in the trust path. Alternatives: LiteLLM-as-proxy (rejected: extra process in trust path), Portkey/Bifrost/Envoy AI Gateway (heavier infra than a single-user local system needs).

## D-0009 — Agent runtime: LangGraph (Python) behind our own AgentRuntime interface
- **Date:** 2026-07-16 · **Status:** PROPOSED (part of Option A; superseded if Option B/C chosen)
- **Rationale:** LangGraph MIT, 1.x GA (verified 2026-07-16), model-agnostic, durable-state graphs; isolated behind our interface so it can be replaced (binding requirement). Alternatives: Pydantic-AI (MIT, strong typing; runner-up), OpenAI Agents SDK (OpenAI-centric defaults), Claude Agent SDK (TS SDK + runtime under Anthropic commercial ToS; not provider-neutral — rejected for core).

## D-0010 — Observability viewer: Jaeger v2 (Apache-2.0)
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Rationale:** Verified 2026-07-16: Jaeger v2 is Apache-2.0, CNCF-graduated, single all-in-one local container, natively an OTel Collector distro. Grafana LGTM stack rejected (AGPL); SigNoz rejected (default distribution bundles ee-licensed code); otel-desktop-viewer/otel-tui (Apache-2.0) noted as lightweight dev alternatives.

## D-0011 — MCP spec target: 2025-11-25
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Target MCP spec `2025-11-25` (current; verified 2026-07-16), TS SDK 1.29.x / Python SDK 1.28.x (MIT). Adopt the spec's security best practices (no token passthrough, RFC 8707 resource indicators, per-client consent). Do **not** build against unreleased draft-spec features (stateless MCP, server/discover).

## D-0012 — Local model baseline set (initial; revisited each phase)
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Initial Ollama-served local set for the 128 GB M3 Max (all verified 2026-07-16): **Qwen3.6-35B-A3B** (Apache-2.0, MoE ~3B active — `fast_conversation`/`tool_selection`), **gpt-oss-120b** (Apache-2.0, MXFP4 ≈ 61–80 GB — `deep_reasoning`), **Qwen3.5-122B-A10B** (Apache-2.0 — alternate large all-rounder), **Gemma 4 26B-A4B** (Apache-2.0, multimodal — `vision`), plus a small embedding model (final pick at Phase 1 slice 1.2). DeepSeek-V4-Flash rejected (~142 GB @4-bit — doesn't fit); Llama 4 rejected (non-OSI community license, superseded quality).
- **Note:** concurrent-memory budgeting (KV cache + speech + DB + UI) is part of slice 1.2 acceptance; the routing policy never mandates a large model where a small one meets requirements (R-MODEL-04).

## D-0013 — Postgres encryption approach
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Baseline: FileVault (whole-disk) + a dedicated, permission-restricted Postgres data directory + field-level application-side encryption (libsodium via established bindings) for sensitive columns, keys held in macOS Keychain. pgsodium rejected as core dependency (pending-deprecation signals at major platforms, verified 2026-07-16); Percona pg_tde noted as a future full-TDE option if desired.
- **Rationale:** Keeps the open-source data layer (PostgreSQL License) with encryption controlled in our code; satisfies R-MEM-03 ("encryption at rest and field-level protection where appropriate").

## D-0014 — Desktop shell: Tauri 2
- **Date:** 2026-07-16 · **Status:** PROPOSED (part of Options A/B)
- **Rationale:** Verified 2026-07-16: Tauri 2.11.x, MIT OR Apache-2.0, system-tray core feature, official global-shortcut/notification/autostart/positioner plugins, Rust core with Swift bridge capability. Electron rejected (bundled Chromium weight; Tauri meets needs with native bridges).

## D-0015 — macOS control stack (Phase 2 surface)
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Native trio verified current on macOS 26 Tahoe (2026-07-16): **AXUIElement** (UI-tree inspect/act) + **CGEventPost** (input synthesis) + **ScreenCaptureKit/SCScreenshotManager** (capture; `CGWindowListCreateImage` is obsoleted) + **`shortcuts run`/osascript** (app-level actions), behind our own Swift/Rust bridge in the Tauri companion. Three TCC grants documented: Accessibility, Screen & System Audio Recording, Automation. Third-party synthesis libs (nut.js: paid/dormant; robotjs: recently revived; pyautogui: unmaintained) rejected in favor of direct CGEvent via our bridge.

## D-0016 — Spatial input model pinned to verified platform constraints
- **Date:** 2026-07-16 · **Status:** PROPOSED (constraint restatement; binding docs already require it)
- **Decision:** Core interaction model uses: visionOS look-and-pinch/hover (no raw gaze — none exists for third-party apps, verified 2026-07-16); Quest hand tracking + controllers (no eye tracking hardware on Quest 3/3S); WebXR hands + transient-pointer; webcam MediaPipe (Apache-2.0, Apple Silicon wheel verified) for desktop gestures. OpenXR targeted on Quest/PC runtimes; **no production macOS OpenXR runtime exists** — macOS spatial output uses WebXR-to-headset, native visionOS client (Phase 11), and flat-screen 3D fallback. Re-verify all of this before Phases 6/7/11 per R-SPA-03.

## D-0017 — Session continuity mechanics
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Every future session starts by reading `docs/IMPLEMENTATION_PLAN.md` → `docs/DECISION_LOG.md` → `docs/CAPABILITY_PARITY_MATRIX.md` → root `CLAUDE.md` (and module CLAUDE.md for touched modules), then resumes at the recorded current slice. Conflicts with recorded decisions are surfaced at a check-in, never silently re-decided. End-of-session updates are mandatory (docs/07).
