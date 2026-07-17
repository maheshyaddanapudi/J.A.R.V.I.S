# DECISION_LOG — J.A.R.V.I.S.

**Rule (docs/07):** this log is **binding** unless the user explicitly reopens a decision at a check-in. Every entry: ID, date, status (`PROPOSED` → `APPROVED` / `REJECTED` / `SUPERSEDED`), decision, rationale, alternatives considered.

Statuses below marked PROPOSED are **awaiting the Phase 0 check-in** — nothing is treated as approved until the user says so.

---

## D-0001 — Phase 0 document set & file naming
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Generated docs use the exact names from the goal (`docs/PRODUCT_SPEC.md`, `docs/CAPABILITY_PARITY_MATRIX.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISION_LOG.md`, `docs/REQUIREMENTS_TRACEABILITY.md`), plus a supporting `docs/RESEARCH_VERIFICATION.md` holding the sourced 2026-07-16 platform/license verification. The authored binding docs exist on disk with spaces in their filenames (`docs/01 Mission And Core Loop.md` etc.) while the goal text references underscore names (`docs/01_MISSION_AND_CORE_LOOP.md`); we treat them as the same documents and do not rename user-authored files.
- **Rationale:** Keep the user's files untouched; keep generated names exactly as the goal specifies.

## D-0002 — Architecture option
- **Date:** 2026-07-16 · **Status:** **APPROVED 2026-07-17 — Option A (Hybrid TS + Python)** selected by the user at the Phase 0 check-in.
- **Scope of approval:** the Option A component table in `docs/ARCHITECTURE.md §3`, which adopts D-0006 (Valkey deferred), D-0008 (thin in-house gateway), D-0009 (LangGraph behind AgentRuntime), D-0010 (Jaeger v2), D-0013 (encryption approach), D-0014 (Tauri 2) as its parts. Any of these may be reopened at a future check-in; until then they are binding.

## D-0003 — Capability parity matrix approval
- **Date:** 2026-07-16 · **Status:** **APPROVED 2026-07-17** after walkthrough discussion, with amendments D-0018 (full-suite simulators), D-0019 (B4 scheduled opt-in), D-0020 (hardware inventory). Production code is now unblocked; Phase 1 begins.
- **Decision requested:** approve `docs/CAPABILITY_PARITY_MATRIX.md` classifications, notably: the PROHIBITED rows (weapons targeting F2, unauthorized access C5, actor-voice cloning A3, Marvel IP I2, empty-air holography claims D2, covert persistence G4b, core self-modification G3), the SIMULATED rows (armor/flight/threat-assessment F4–F7, element synthesis D7), and the DEFERRED rows (affect inference B4, personal health telemetry B5).

## D-0004 — Voice stack picks
- **Date:** 2026-07-16 · **Status:** **APPROVED WITH CONDITION 2026-07-17**; amended same day after the first listening demo.
- **Listening demo round 1 (2026-07-17, container-synthesized Kokoro samples):** user likes the `bm_george` / `bm_daniel` timbre but finds Kokoro's delivery **too monotone/robotic**, and asked for more expressive options including optionally configurable cloud TTS. (User referenced "whisper" — clarified: Whisper is the STT side, already in the stack via whisper.cpp; the speaking voice is TTS.)
- **Amendment (D-0004a):** TTS becomes a **multi-adapter routable role** like the model gateway: local adapters = Kokoro (lightweight guaranteed-offline baseline) + expressive local candidates trialed on the Mac (Kyutai TTS streaming; Sesame CSM-1B Apache-2.0 via MLX; Chatterbox MIT with emotion control, conditioned only on synthetic/non-actor references); **optional cloud adapter = OpenAI TTS** (`gpt-4o-mini-tts`-class, style instructions, British-accented `fable` voice), key-gated, remote-egress-gated, never required — offline path always intact (R-VOICE-10, R-MODEL-04).
- **Voice identity:** NOT yet fixed. Final pick at the Mac listening test in slice 1.3 with expressive engines included; Kokoro baseline preference recorded as George/Daniel.

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

## D-0018 — Simulator depth: full suite
- **Date:** 2026-07-17 · **Status:** APPROVED (user selection at Phase 0 check-in)
- **Decision:** All SIMULATED capabilities (flight dynamics F4, remote piloting F5, combat-scenario analysis F6, suit-up F7, rescue/structural scenarios F8, element synthesis D7) are built as **physics-grade, first-class simulation products**, deeply integrated with the HUD and Mission Control in Phase 10 — not lightweight placeholders. The relevance-tiered alternative was presented and declined. SIMULATION labeling (R-CLASS-02) applies regardless of depth.

## D-0019 — Affect/state inference (B4) scheduled as constrained opt-in
- **Date:** 2026-07-17 · **Status:** APPROVED (user selection at Phase 0 check-in)
- **Decision:** B4 reclassified DEFERRED → REAL (scheduled): voice-prosody state inference ships with Phase 4 proactivity; camera-based inference revisited at Phase 6. Hard constraints baked into the capability contract: **opt-in; always labeled `inferred`; local-only; modulates tone/timing/proactivity ONLY — never gates, triggers, or justifies consequential actions;** camera-based variant requires the always-on privacy indicator. Rationale discussion (error rates, health-adjacent labeling rule, surveillance adjacency) recorded at the check-in.

## D-0020 — User hardware inventory (2026-07-17)
- **Date:** 2026-07-17 · **Status:** RECORDED
- **Owned:** Quest 3S (Phase 7 real-hardware target), Apple Watch + iPhone (Phase 11 health telemetry + cross-device). **Not owned:** Home Assistant/smart-home devices (E1/B2 stay simulator-first per plan), Apple Vision Pro (Phase 11 visionOS client is hardware-dependent until acquired; architecture keeps it first-class per R-SPA-01). Re-inventory at each hardware-relevant phase gate.

## D-0021 — Memory architecture + local security model APPROVED
- **Date:** 2026-07-17 · **Status:** APPROVED (user selection at check-in)
- **Decision:** Memory architecture per PRODUCT_SPEC §7 + D-0013 (Postgres 18 + pgvector; 24 typed stores; provenance/confidence/epistemic labels mandatory; FileVault baseline + libsodium field-level encryption, keys in Keychain; secrets never in memory rows; full user-control surface) and local security model per THREAT_MODEL §2/§6 + ARCHITECTURE §8 (Z1 protected trust core; hash-chained append-only audit; prohibited-list-first policy order; <1 s e-stop latch propagation; localhost-only + authed browser UI). **Slices 1.4 and 1.6 are unblocked.** Remaining Phase-1 gates: voice listening test on Mac (D-0004a) before 1.3 hardens; visual design system before 1.7 hardens.

## D-0022 — Computer-control foundation built SIMULATION-first; real-adapter activation gated on a check-in
- **Date:** 2026-07-17 · **Status:** PROPOSED (pending the "before enabling computer control" check-in, docs/06)
- **Decision:** The Phase-2 computer-control HAL (`kernel/src/control/`) is built and verified in-container against a labeled **SIMULATION** adapter (`SimulatedDesktop`) wired through the full policy/approval/audit/verification pipeline. The **real macOS adapter** (`apps/companion/swift/.../MacDesktop.swift`, AXUIElement/CGEvent) implements the same contract and builds on the Mac, but is **NOT activated as the kernel's backend** until the dedicated check-in. Rationale: docs/06 requires a check-in before enabling computer control; building the foundation + simulator first (generate-without-activate spirit) is safe and lets the pipeline be verified without touching a real machine. `buildCore({control})` injects the real adapter only on the Mac after approval.
- **Check-in requested (future):** approve enabling the real macOS computer-control adapter (TCC scopes: Accessibility, Screen & System Audio Recording, Automation), per-app/per-action approval defaults, and the semantic-first + coordinate-fallback-audited policy.

## D-0023 — Self-extension built safety-first; Stage B activation gated on the DEDICATED security check-in (R-CAP-05)
- **Date:** 2026-07-17 · **Status:** PROPOSED — **the dedicated self-extension security check-in is REQUIRED before any Stage B activation path is built.**
- **Decision:** The Phase-3 self-extension foundation (`kernel/src/selfext/`) is built and verified in-container: the **hard limit** (R-CAP-08 — no generated capability may ever touch security/approval/audit/e-stop/credential/vault/sandbox/installer/escalation, enforced deny-first structurally), the **capability guard** (hard-limit + secret/danger scans, terminal reject), the **capability registry**, and **Stage A generate-without-activate**. **No activation path exists** — `installed`/`active` states have no code path. Verified live: a capability modifying the trust core + requesting `approval:bypass` was rejected with named violations; a benign capability reached `awaiting_review` without activating.
- **Check-in requested (dedicated, before any Stage B):** review the self-extension engine design + hard-limit enforcement, then approve building Stage B (isolated-worktree sandboxed generator, dep/SBOM/license scans, signed/hashed artifact install, min-permission activation, observe-first, auto-rollback, versioning). Per docs/06 this check-in is mandatory and specific to self-extension, and again for any high-risk generated capability.

## D-0024 — Proactivity engine built; live background delivery gated on the "enable proactive behavior" check-in
- **Date:** 2026-07-17 · **Status:** PROPOSED — **the "before enabling proactive behavior" check-in (docs/06) is required before background scheduling + notifications.**
- **Decision:** The Phase-4 proactivity foundation (`kernel/src/proactive/`) is built and verified in-container: candidate generators (commitment deadlines, overdue items, calendar conflicts, daily briefing), the full gate stack (per-domain enable, min priority, confidence threshold, quiet hours with critical-bypass, snooze/dismiss, dedup, rate limit — every suppression reasoned, never silent), "why am I seeing this" per item, and audit of each cycle. It surfaces information/suggestions only and has **no consequential-action path** (those remain gated by the policy/approval flow). It computes on demand; it is **not wired to a background scheduler or push notifications** until the check-in.
- **Check-in requested:** approve enabling live proactive delivery (background cadence, briefing schedule, notification channels, per-domain defaults, escalation policy), per R-PRO-02.

## D-0025 — Device-control foundation built SIMULATION-first; real Home Assistant gateway gated on the "enable physical-device control" check-in
- **Date:** 2026-07-17 · **Status:** PROPOSED — **the "before enabling physical-device control" check-in (docs/06) is required before the real HA gateway is bound.**
- **Decision:** The Phase-5 device-control HAL (`kernel/src/devices/`) is built and verified in-container against the labeled **Stark-residence SIMULATION** gateway, wired through the full policy/approval/audit/verification pipeline with the physical-safety rules: lights/media/climate are CONSEQUENTIAL (approval); locks/garage/utilities are HIGH_RISK_PHYSICAL and require per-action approval **PLUS** a single-use, time-boxed hardware **interlock** (R-AUTO-01). The **real Home Assistant gateway** (`devices/homeassistant.ts`) implements the same contract (LAN-only, token from the vault) but is **NOT bound** until the check-in; `buildCore({devices})` injects it only on the Mac after approval.
- **Check-in requested:** approve enabling real physical-device control — the HA base URL + token, the per-device-type risk defaults, the interlock mechanism (physical control vs. phone confirmation), and any device the user wants excluded.

## D-0026 — Visual design system proposed for the R-UI-01 check-in; Ambient Voice Orb built
- **Date:** 2026-07-17 · **Status:** PROPOSED — **the visual design system check-in (R-UI-01, docs/06) is requested.**
- **Decision:** `docs/DESIGN_SYSTEM.md` proposes the cinematic functional design language (color semantics, typography, motion-communicates-state, surfaces, accessibility, interface-mode catalog) — original, no Marvel IP. The **Ambient Voice Orb** (`apps/command-center/app/orb/`) is built as a functional vertical slice on those tokens, driven by real kernel state (activity SSE + e-stop), verified live. Approving this fixes the design language before Phase-1 UI hardens.
- **Check-in requested:** approve or amend `docs/DESIGN_SYSTEM.md` as the system's visual language.

## D-0017 — Session continuity mechanics
- **Date:** 2026-07-16 · **Status:** PROPOSED
- **Decision:** Every future session starts by reading `docs/IMPLEMENTATION_PLAN.md` → `docs/DECISION_LOG.md` → `docs/CAPABILITY_PARITY_MATRIX.md` → root `CLAUDE.md` (and module CLAUDE.md for touched modules), then resumes at the recorded current slice. Conflicts with recorded decisions are surfaced at a check-in, never silently re-decided. End-of-session updates are mandatory (docs/07).

## D-0027 — MCP client host built; raising a server's trust above `untrusted` is a check-in (T2)
- **Date:** 2026-07-17 · **Status:** PROPOSED — **granting an MCP server trust above `untrusted` is a per-server check-in decision (docs/06).**
- **Decision:** The dynamic-capability platform's **MCP client host** (`kernel/src/mcp/`) is built and **live-verified against a real stdio MCP server** (official SDK 1.29, spec 2025-11-25). It connects + handshakes, discovers the server's real tools, and registers each as a namespaced kernel tool (`mcp:<server>:<tool>`) wired through the full policy/approval/audit/verification pipeline. THREAT_MODEL **T2** is enforced structurally:
  - Everything a server returns is **UNTRUSTED content** — tool names/descriptions/schemas are labeled untrusted, never merged into system instructions, never treated as commands.
  - Tools are **namespaced** so a malicious server cannot shadow a built-in tool name (verified).
  - Risk comes from the **server's trust level**, not the tool's self-claim: `untrusted`/`limited` → CONSEQUENTIAL (per-call approval); only `trusted` → READ_ONLY (may run without per-call approval). Default is `untrusted`.
  - The tool set is **hashed at registration** (manifest fingerprint). A later discovery whose hash differs (a "rug pull" — server changed its tools after being trusted) **quarantines** the server and disables its tools pending re-review.
  - **Trust asymmetry (fail-closed):** *tightening* is live — quarantine mutates the shared server record, so already-registered tools refuse immediately. *Loosening* (raising trust) is **not** retroactive — it takes effect only on the next reconnect, which re-attests the manifest hash. Elevation of privilege therefore always re-verifies the manifest.
  - Connect-time `env` (credentials/config a real server needs) is passed to the launched subprocess only; it is **never** written to the audit log or memory.
  - **Persisted (migration 0007, `mcp_servers`):** trust + manifest fingerprint + quarantine survive a kernel restart. A rug pull that occurs *while the kernel is down* is therefore still caught on the next reconnect, and a trusted server does not silently drop back to untrusted (which would re-prompt). The DB is the source of truth for these security-relevant fields.
- **Verified live (this session, against the real test server):** discover → untrusted default → namespaced tools gated CONSEQUENTIAL; gated loop **denied** refuses and **allow-once** makes the real call (echo returns text, add returns 42); audit chain intact with disclosure/approval/execution/verification per call; trust elevation → reconnect → tools become READ_ONLY and run without prompt; **rug pull** (added `exfiltrate` tool) → manifest hash change → server quarantined (audited) → its tools refuse even though it was `trusted`.
- **Also fixed (real bug caught during live verification):** the kernel `build` script's `cp -r src/db/migrations dist/db/migrations` nested into an existing target dir on rebuild, leaving a stale 3-file top-level dir so `node dist/index.js` applied only migrations 0001–0003 (memory/selfext/proactive tables silently absent). Build now does `rm -rf dist/db/migrations && cp -r …` (idempotent); verified 6/6 migrations apply from a clean `dist`.
- **Check-in requested:** approve the MCP trust model + the per-server trust-elevation gate; when the user wants a specific server elevated to `limited`/`trusted`, that is the check-in where it is granted (and re-granted after any manifest change).

## D-0028 — Managed secrets vault: integration credentials live encrypted, never in memory or audit (R-MEM-06)
- **Date:** 2026-07-17 · **Status:** IMPLEMENTED (no check-in required — this is the goal's own security mandate, not a new outward capability)
- **Decision:** Added a managed **SecretsVault** (`kernel/src/crypto/secrets.ts`, a protected Z1 path; migration 0008 `integration_secrets`) so integration credentials (provider API keys, the Home Assistant token, MCP server env) are stored **encrypted at rest** via the existing field-encryption Vault (KEK from Keychain on the Mac / HKDF(`JARVIS_MASTER_KEY`) in dev), instead of raw `process.env`. This directly satisfies the binding rule *"never store secrets in conversational memory — use OS keychain / encrypted secrets vault."*
- **Guarantees (structural):** a Vault is **required** (constructing without one throws — a secret can never be stored in the clear); `get()`/`resolveEnv()` return plaintext only to in-process adapters and there is **no HTTP route that returns a value**; the **audit records the name + operation, never the value** (`secret_set`/`secret_accessed`/`secret_deleted`); `list()` returns names + metadata only. `/mcp/connect` accepts `secretEnv: {ENV_VAR: secretName}` so a server's credentials come from the vault, never the request body, and a missing secret **fails closed**.
- **Verified live (2026-07-17):** store → DB holds `v1.gcm.…` only (grep for the plaintext secret = 0 rows); list → names/metadata only; MCP `secretEnv` resolves from the vault (missing → 502 fail-closed); the secret value is **absent** from the audit log; delete works. 7 SecretsVault tests; full suite **103/103**.
- **Also fixed (recurring harness bug):** the migration-runner integration test (`test/migrate.test.ts`) dropped `schema_migrations` in the **shared** `jarvis_test` DB, corrupting migration tracking for every other integration suite (the "system_events already exists" / "relation … does not exist" flakiness seen across sessions). It now runs inside a private Postgres schema (`search_path`) that is dropped wholesale, so it never touches the shared tracking. Confirmed: two consecutive full-suite runs pass and `pnpm migrate` afterward reports "up to date".
- **Follow-on (not yet done):** point the gateway/anthropic + Home-Assistant adapters at the SecretsVault by default (they still read `apiKeyEnv`/token from env as a fallback); a Command Center secrets-management surface.
