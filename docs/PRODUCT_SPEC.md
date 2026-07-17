# PRODUCT_SPEC — J.A.R.V.I.S.

**Status:** DRAFT — pending Phase 0 check-in approval
**Generated:** 2026-07-16 (Phase 0)
**Authority:** This document is generated from the binding authored docs (`docs/01`–`docs/07`). If anything here conflicts with those docs, the authored docs win (see README "Precedence"). Requirement IDs (`R-…`) are defined in `docs/REQUIREMENTS_TRACEABILITY.md`.

---

## 1. Product definition

J.A.R.V.I.S. is a **local-first personal AI operating system** for a single user on one MacBook Pro (M3 Max, 128 GB unified memory, 1 TB storage), expandable later to local servers, edge devices, XR headsets, and room hardware. It must be simultaneously:

1. **A genuine assistant** — operates the Mac, controls connected devices, talks to applications, manages information, learns preferences, acts proactively, and extends itself with new capabilities under a controlled lifecycle.
2. **A cinematic J.A.R.V.I.S. experience** — restrained British-butler voice, animated functional HUDs, engineering workshop, holographic-style visualizations, gesture/gaze input where the platform supports it, and cross-device presence.

It is a **long-lived platform, not a demo**. Every subsystem is built as a real vertical slice with typed contracts, tests, audit, and documented state in the five-state capability parity matrix.

### 1.1 The honesty rule (binds every line of code) — R-CORE-02

- Every capability that is physically, legally, and technically achievable is implemented **for real**. No mock data, hardcoded demos, fake terminal output, decorative screens, pre-recorded responses, simulated tool execution, or placeholder integrations standing in for achievable functionality.
- Capabilities depending on hardware not yet owned use **production-quality typed hardware-abstraction interfaces** with realistic development adapters and tested simulators implementing the same typed contract a future real plugin would.
- Fictional / physically impossible / unsafe / illegal / private-system-dependent capabilities use **clearly-marked SIMULATION adapters** behind the same typed contract; they are never silently omitted and never represented as live.
- The system never claims a simulated, inferred, or unavailable capability is real. Simulation surfaces carry a permanent, non-dismissable `SIMULATION` state.

### 1.2 The core loop (Phase 1 vertical slice) — R-CORE-03

```
[Wake: "Jarvis" | push-to-talk | typing | desktop content selection]
        │
        ▼
[Context identification] ──► active app/window, conversation state, time, prior objectives
        │
        ▼
[Objective evaluation]  ──► the request is an OBJECTIVE, not a literal command
        │
        ▼
[Decision] ──► answer | retrieve | plan | use tool | delegate to agent | request approval | permitted action
        │            (pre-Phase-3: may RECORD a missing capability; must NOT claim it can generate/install/activate one)
        ▼
[Streamed spoken + visual response] ──► concise execution state; never exposes hidden chain-of-thought
        │
        ▼
[Gated execution] ──► approval where required; observable; interruptible; emergency-stoppable
        │
        ▼
[Independent verification of outcome] ──► then: record result, artifacts, decisions, audit, memory
        │
        ▼
[Next-action suggestion or permitted follow-through]
```

This loop must work end-to-end — real voice in, real reasoning, real gated action, real voice out, cinematic display — **before building outward**, and must run fully locally including a complete offline path.

---

## 2. Voice subsystem — R-VOICE-01 … R-VOICE-10

### 2.1 Functional requirements

| # | Requirement |
|---|---|
| V1 | Local always-listening wake word **"Jarvis"** (configurable), plus push-to-talk (global hotkey) and keyboard/text activation. |
| V2 | **Streaming STT** (partial hypotheses while speaking) and **streaming TTS** (audio begins before full text is generated). |
| V3 | **Natural turn-taking** and **barge-in**: user speech interrupts playback within ≤ 300 ms; the interrupted utterance is truncated in the transcript and marked interrupted. |
| V4 | VAD, echo cancellation (so the mic doesn't trigger on J.A.R.V.I.S.'s own voice), and noise suppression. |
| V5 | Optional **local speaker verification** (enrolled owner profile; per-command verification threshold configurable; never sole gate for consequential actions — approval flow still applies). |
| V6 | **Whisper/quiet modes**: reduced output volume/verbosity mode, text-only mode, and "do not speak" state. |
| V7 | Configurable response **length / formality / urgency** profiles. |
| V8 | **Spoken approvals, warnings, and summaries**: approval requests are speakable and answerable by voice, with visual confirmation always available; voice-only approval is allowed only for LOW-risk classes (§7). |
| V9 | **Metrics**: measured wake-word latency & false-wake rate, STT latency & word accuracy, TTS time-to-first-audio, end-to-end voice round-trip, interruption latency. Metrics are recorded locally and visible in Health/System Telemetry. |
| V10 | **Offline fallback**: complete voice path (wake → STT → LLM → TTS) using only local engines. |

### 2.2 Voice identity — R-VOICE-11

A distinct, restrained **British-style synthetic voice**. It must NOT clone or imitate Paul Bettany or any specific actor. Candidate open-source voices are evaluated at the voice-stack check-in (see `docs/ARCHITECTURE.md` §6 and DECISION_LOG). Persona: composed, dry, understated; brevity by default; formality configurable.

### 2.3 Replaceability — R-VOICE-12

Every engine — wake word, STT, TTS, VAD, noise suppression, speaker verification, audio routing — is an **open-source, replaceable component** behind a typed interface:

```
WakeWordEngine    { start(cfg), stop(), events: wake(confidence, ts) }
SttEngine         { beginStream(cfg) -> { pushPcm(), partials$, final$ , close() } }
TtsEngine         { synthesizeStream(text$, voice, style) -> pcm$ ; stop() }
VadEngine         { pushPcm() -> speech/no-speech events }
SpeakerVerifier   { enroll(samples), verify(pcm) -> {score, decision} }
AudioIO           { capture(device) -> pcm$, play(pcm$), duck(), stopPlayback() }
```

(Names indicative; final contracts live in code with versioned schemas.)

### 2.4 Definition of done (voice, Phase 1 scope)

- All Phase-1 acceptance criteria in `docs/06` items "Say Jarvis / push-to-talk", "Interrupt naturally", "streamed spoken and visual response", "local STT/TTS", "offline workflow" pass on the real machine.
- Latency budget met: wake→listening indicator ≤ 500 ms; end of user utterance→first TTS audio ≤ 2.0 s with a local fast-conversation model; barge-in stop ≤ 300 ms.
- False-wake rate measured over ≥ 8 h ambient audio and recorded in telemetry docs.

---

## 3. Model gateway — R-MODEL-01 … R-MODEL-06

### 3.1 Routable roles

Separately routable model roles (each independently configurable to a provider+model): `fast_conversation`, `deep_reasoning`, `coding`, `vision`, `stt`, `tts`, `embeddings`, `reranking`, `planning`, `verification`, `safety_review`, `tool_selection`, `agent_routing`, `long_context`, `local_fallback`.

### 3.2 Providers

Anthropic-native, OpenAI-compatible, Gemini-compatible, **Ollama**, and arbitrary configurable local/remote endpoints. Core logic **must not couple to any one provider's message format**: an internal neutral message/tool schema is translated at the adapter boundary.

### 3.3 Gateway features

- Capability discovery per model: context window, tool-use support, structured output, multimodal input, streaming.
- Structured-output validation (JSON-schema-checked; retry/repair policy).
- Cost + latency tracking per call; per-role and per-day budgets.
- **Privacy classification** on every request: `LOCAL_ONLY` data classes (memory contents, credentials-adjacent text, screen captures, audio, personal documents) may not be routed to remote providers unless the user has explicitly configured and approved that flow (R-LOC-02).
- Automatic fallback chains and **manual pinning** per role.
- Per-agent / per-tool model policies.

### 3.4 Local-capable-first routing — R-MODEL-04

Prefer local models when they meet the task's **quality, latency, tool-use, and context** requirements; use cloud models only for an explicitly configured capability or quality lift. Routing considers quantization, context length, KV-cache pressure, concurrent agents, vision/speech services, and DB/app memory — **no mandate that every task use a large local model**. The whole system runs **fully offline** when configured (local Ollama-compatible models, local STT/TTS/embeddings), and the user can disconnect external providers and complete a supported workflow (Phase 1 acceptance).

### 3.5 Definition of done (gateway, Phase 1 scope)

- Two providers demonstrably interchangeable per role via config alone (e.g., Ollama + one cloud provider) with no core-code change.
- Offline mode verified by disabling network egress for the gateway and completing the Phase-1 workflow.
- Per-call audit record: role, provider, model, token counts, latency, privacy class, fallback events.

---

## 4. Computer control (macOS) — R-CTRL-01 … R-CTRL-05

### 4.1 Capabilities (Phase 2 unless noted)

Screen capture (ScreenCaptureKit), Accessibility API UI-tree inspection (AXUIElement), semantic window/app discovery, mouse & keyboard synthesis, clipboard, app launching/switching, file operations, browser automation (Playwright + CDP), terminal execution (PTY with policy), AppleScript/JXA, and macOS Shortcuts — via native macOS bridges (Tauri/Rust/Swift). *Phase 1 includes exactly: one real read-only tool and one reversible Mac action through this stack's approval pipeline.*

### 4.2 Semantic-first rule — R-CTRL-02

Prefer semantic APIs, accessibility trees, CLIs, app-native APIs (AppleScript/JXA/Shortcuts), and DOM access over coordinate-based clicking. Coordinates only when nothing structured exists, and each coordinate fallback is logged as such.

### 4.3 Action contract — R-CTRL-03, R-CTRL-04

Every computer action is: **observable** (live activity timeline), **interruptible** (cancel + emergency stop), **logged** (audit with before/after evidence where feasible), **permission-scoped** (per-app/per-path/per-domain scopes), **verifiable** (independent post-action check), and **reversible where possible** (undo plan captured *before* execution).

Before any consequential action the user sees: what will happen, affected apps/files/accounts, the proposed commands/UI actions, the reason, risk class, reversibility, rollback plan, and the required approval level.

### 4.4 Definition of done

- Phase 1: one read-only tool + one reversible Mac action pass acceptance with full approval flow and rollback demonstrated.
- Phase 2: UI-tree inspection on ≥ 5 common apps; browser automation on real sites; file & terminal operations under scope enforcement; screen understanding feeding context; TCC permissions documented with setup guide.

---

## 5. Dynamic capability platform & self-extension — R-CAP-01 … R-CAP-08

### 5.1 Registries (no permanently predetermined connector list)

Typed, versioned registries for: **agents, tools, skills, rules, prompts, workflows, models, devices, hardware plugins, MCP servers/clients, integrations, simulators, displays, sensors**. Each entry: id, semver, typed contract, permission manifest, risk class, provenance, enable/disable state, health, docs.

### 5.2 Protocols

**MCP is the primary external tool/context protocol** (TS + Python SDKs), plus adapters for local CLIs, HTTP/OpenAPI/GraphQL, WebSockets/webhooks, databases, filesystems, and (later phases) Home Assistant, MQTT, Matter, Thread, Zigbee, Z-Wave, Bluetooth, serial/USB, ROS 2, and direct hardware.

### 5.3 Self-extension lifecycle (Phase 3; HIGHEST-RISK subsystem) — R-CAP-04 … R-CAP-08

**Stage A — generation without activation.** Detect missing capability → search existing registries first → research authoritative docs → verify licenses → define typed contract + permission manifest + risk classification + test requirements → generate implementation in an **isolated Git worktree/sandbox** → generate unit/integration/security/failure tests → run formatting, type-checking, tests, static analysis, dependency + secret + license scans → run against fixtures in a restricted sandbox → produce a human-readable capability report, code diff, permission summary, risk summary. **Stage A may not install or activate anything.**

**Dedicated check-in.** A design-and-security review with the user for the self-extension engine itself before any activation path is built, and again for any high-risk generated capability.

**Stage B — controlled activation.** Explicit approval → install signed/hashed artifact → activate with minimum permissions → observe initial executions → verify first real result → store provenance/version/audit → auto-disable/rollback on defined failures. Hot-reload only where proven safe; never activation-by-passing-tests alone.

**Hard limit (non-negotiable).** No generated capability may ever create, alter, or bypass: security policy, approval policy, audit logging, emergency-stop controls, credential storage, sandbox enforcement, permission-escalation logic, or the capability-installer security itself. Enforced structurally (protected paths + separate trust domain + install-time diff scanning), not by convention.

Pre-Phase-3 behavior: J.A.R.V.I.S. may **identify and record** a missing capability (a `capability_gap` record) but must not claim it can generate, install, or activate one.

### 5.4 Definition of done (Phase 3)

End-to-end demonstration: detect → research → design → generate → test → security-scan → review → approve → install → use → verify → roll back, with the dedicated security check-in held before the first activation path exists.

---

## 6. Autonomy & approval — R-AUTO-01 … R-AUTO-04

### 6.1 Default policy

| Class | Examples | Policy |
|---|---|---|
| READ_ONLY | inspect, retrieve, search, status | May run automatically |
| LOW_REVERSIBLE | open app, create file in workspace, set volume | Automatic **only when explicitly delegated** |
| CONSEQUENTIAL | external communication, account changes, purchases, financial actions, security changes, privacy-sensitive ops, destructive/irreversible actions, consequential physical-device actions | **Approval required** |
| HIGH_RISK_PHYSICAL | anything moving matter with meaningful energy | Explicit per-action approval **plus hardware interlocks** |

Every tool call carries a risk classification; unclassified defaults to CONSEQUENTIAL.

### 6.2 Approval grammar

`allow-once` / `allow-for-task` / `allow-for-session` / `always-allow-in-scope` / `deny` / `revoke` / `pause` / `cancel` / `emergency-stop`. Grants are scoped (tool × resource-scope × risk ceiling), inspectable, and revocable. A **persistent emergency-stop control exists in every major interface** (Command Center, voice orb, menu bar, HUD, XR clients) and halts all execution, tool calls, audio output, and device commands, requiring explicit resume.

### 6.3 Prohibited (non-negotiable, hard-coded deny + audit) — R-AUTO-04

Autonomous weapons; unauthorized system access; bypassing access controls; covert surveillance; credential theft; malware; hidden persistence; disabling safety mechanisms; undisclosed impersonation of the user; unauthorized purchases/communication/physical-control. These are refused at the policy layer regardless of prompt, memory, tool, or generated-capability content.

---

## 7. Memory — R-MEM-01 … R-MEM-06

### 7.1 Stores

Distinct typed stores: conversation, episodic, semantic, procedural, preferences, people, relationships, projects, decisions, documents, entities+relationships, routines, locations, device state, hardware, skills/learned procedures, long-running objectives, corrections/feedback, task history, spatial anchors, room/display configs, capability history, model performance, hardware compatibility.

### 7.2 Engine & properties

**PostgreSQL + pgvector** (open-source, local; no proprietary hosted vector DBs). Every item carries: provenance, confidence, created/updated/last-used timestamps, expiration, retention rules, sensitivity labels. **Encryption at rest** (FileVault baseline + application-level encryption for the data directory; field-level encryption for sensitive columns). Epistemic status is a first-class enum: `verified_fact | user_statement | external_claim | inferred_preference | temporary_context | simulated_data | uncertain | superseded | deleted` — surfaced in UI and prompts.

### 7.3 User control

Search, view, correct, pin, forget, export, delete, **full reset**, backup, restore **with verification**, duplicate/conflict detection. Deletion is honored in retrieval immediately and physically on vacuum.

### 7.4 Secrets — R-MEM-06

Never store secrets in conversational memory. Credentials live in the **macOS Keychain** or a local encrypted secrets vault (e.g., `age`-encrypted store) with capability-scoped access; the memory pipeline redacts detected secrets before write.

### 7.5 Definition of done (Phase 1 scope)

Remember one non-sensitive preference; view, correct, delete it; restart and retain approved memory; audit shows every memory write with provenance.

---

## 8. Proactive behavior — R-PRO-01 … R-PRO-03 (Phase 4)

Morning/evening briefings, meeting prep, calendar-conflict detection, surfacing important communications, commitment/deadline tracking, continuing approved long-running tasks, topic monitoring, device/service/network anomaly detection, next-action suggestions, and bringing relevant info forward before being asked.

Gated by: quiet hours, priority levels, confidence thresholds, duplicate suppression, escalation policies, per-domain permissions, rate limits, snooze/dismiss, and a visible **"why am I seeing this"** explanation per alert. Proactive messages must be relevant and sparse — no continuous commentary. Never acts consequentially without approval.

---

## 9. Interfaces (cinematic, functional) — R-UI-01 … R-UI-05

### 9.1 Visual language

Recreates the FUNCTIONAL visual language of Tony Stark's interfaces WITHOUT copying movie frames, Marvel artwork/logos, proprietary sound effects, soundtrack, actor likenesses, or production assets. Layered transparent surfaces on dark backgrounds; fine technical typography; **cyan/blue = operational, amber = advisory, red = critical, white = focal info**; radial/orbital diagnostics; fine grids; wireframes; depth/parallax; motion that communicates state; lighting/shadows; smooth camera moves; readable silhouettes; progressive disclosure. Accessibility: reduced-motion, high-contrast, scalable type. **Every animation communicates state, causality, priority, relationship, progress, warning, completion, or failure** — no generic neon dashboards, meaningless circular charts, fake code, random telemetry, static movie skins, or unreadable noise. Everything on screen has a function. A visual design system is finalized at its own check-in before Phase 1 UI work hardens.

### 9.2 Interface modes (all real vertical slices: live data or clearly-labeled simulator, never an empty screen)

| Mode | Phase | Definition of done (summary) |
|---|---|---|
| **Command Center** (browser) | 1 | Shows current objective, execution state, selected model, tool activity, approval state, results, activity timeline, memory panel, audit view, emergency stop. All live data. |
| **Ambient Voice Orb** | 1 | Always-available minimal presence (desktop): wake/listening/thinking/speaking/error states animated meaningfully; barge-in works from orb state; emergency stop reachable. |
| **Iron-Man-style HUD** | 10 | Weapons/targeting replaced with safe equivalents: object selection, inspection, navigation, search regions, robotics/drone test targets, rescue planning, structural/environmental analysis, diagnostics. Live sensor data or labeled simulators. |
| **Workshop** (engineering copilot) | 6 | 3D/CAD viewing + manipulation, digital twins, mouse+voice(+gesture where supported) manipulation, multi-display, flat-screen 3D fallback, spatial persistence. |
| **Holotable** | 6+ | Shared spatial scene on flat screen/projector/XR per display registry; real scene data. |
| **Mission Control** | 10 | Long-running multi-agent operations: live agent/task DAG, resource use, intervention controls. |
| **Home Control** | 5 | Home Assistant-backed device control; Stark-residence **simulator** (labeled) until real devices; real devices when available. |
| **Communications** | 4 | Real mail/calendar/messaging integrations the user configures; approval-gated sending. |
| **Intelligence** | 4 | Research briefs with provenance; topic monitoring; source-labeled claims. |
| **Health/System Telemetry** | 1 (system) / later (personal) | Authorized data only; **no medical diagnosis; never presents inferred health as fact**; system metrics (latency, model usage, audit rate) live from day one. |

### 9.3 Definition of done (interface, global)

No interface mode ships as decoration: each is connected to live subsystem data or a labeled simulator behind the same contract. Reduced-motion and high-contrast verified. Every screen exposes emergency stop.

---

## 10. Spatial platform & Spatial Scene Service — R-SPA-01 … R-SPA-05

### 10.1 Targets

Quest 3S / Quest 3 / Apple Vision Pro / OpenXR / WebXR are **first-class architectural targets** with phased implementation (Phases 6–12). OpenXR is the primary cross-platform XR abstraction where supported; **Vision Pro must not be the sole spatial target**.

### 10.2 Spatial Scene Service (Phase 6 foundation)

A hardware-neutral service holding the canonical scene: room geometry, display/sensor/user positions, hand/head/gaze data *where the platform officially provides it*, anchors, object coordinates, occlusion, per-device capabilities, and cross-device synchronization — so the **same J.A.R.V.I.S. object** renders through browser, desktop, projector, transparent display, light-field display, volumetric display, Vision Pro, Quest, OpenXR, WebXR, and a flat-screen 3D fallback. Device capabilities are queried at runtime and degrade gracefully — never assume eye tracking, depth, body tracking, passthrough quality, or hand-tracking precision.

### 10.3 Input & privacy constraints (verified Phase 0; re-verify before each spatial phase) — R-SPA-03

Per `docs/RESEARCH_VERIFICATION.md` (2026-07 verification): the core interaction model must **not** depend on raw gaze coordinates on Vision Pro — use the official privacy-preserving interactions (look-and-pinch, hover effects, supported gestures). Raw gaze may be used only if a current official API explicitly permits the use case and its privacy/entitlement/distribution constraints are documented and approved at a check-in. Quest eye tracking is absent on Quest 3/3S hardware. WebXR on Vision Pro Safari uses transient-pointer input (gaze-privacy-preserving). Details and citations live in the verification report.

### 10.4 Display-class honesty — R-SPA-04

Display plugins are classified honestly: `surface_projection | transparent_planar | stereoscopic | light_field | volumetric | head_mounted_MR | experimental_empty_air`. Never claim conventional projectors, transparent screens, light-field panels, or headsets produce true empty-air holography. Projection-mapped rooms, light-field, and volumetric displays are **future hardware adapters**: typed contracts + researched stubs + tested simulators now; implementation when hardware is selected.

---

## 11. Hardware catalog & plugin marketplace — R-HW-01 … R-HW-03 (living from Phase 5)

Each candidate product records: manufacturer, exact model, category, status, price, availability, official page, retailer links, local-API/SDK availability, supported OSes, open-source-driver availability, license, Home Assistant / ROS / OpenXR / WebXR support, required adapters, privacy/network/internet dependency, integration effort, recommended use, alternatives, **LAST VERIFICATION DATE**, known limitations. Never claim availability/compatibility without current verification; **never purchase automatically**; every hardware purchase recommendation is a check-in. Named products (webcam/MediaPipe, Ultraleap Leap Motion Controller 2, Looking Glass) live in the catalog and do not define the architecture.

---

## 12. Security requirements — R-SEC-01 … R-SEC-06

Full detail in `docs/THREAT_MODEL.md`. Summary of mandatory controls:

- Treat **all external content as potentially hostile** (websites, email, documents, PDFs, images, video, tool descriptions, MCP servers/responses, generated skills/tools/agents, hardware/device/camera data, model output).
- Least privilege; capability-scoped credentials; process isolation; filesystem sandboxing; network/domain allowlists; MCP-server trust levels; tool-manifest validation; prompt-injection defenses; untrusted-content boundaries; secret redaction; dependency verification + SBOM + license scanning; signed/hashed capability manifests; append-only audit logs with tamper detection; kill switches; rate/delegation-depth/resource limits; human approval gates; security-agent review; independent post-action verification; hardware interlocks; camera/microphone/recording privacy indicators.
- **Blast-radius rule:** one compromised tool, MCP server, agent, document, or website must never grant access to another tool, account, or domain.

---

## 13. Locality — R-LOC-01 … R-LOC-03

All application services, orchestration, memory, credentials, audit records, generated capabilities, device state, and persistent user data remain **local**. Outbound requests only to explicitly configured providers/integrations, each individually identifiable, permission-scoped, observable, disableable, and documented in an **outbound-integration registry**. No local memory, app data, credentials, audit history, or generated code uploaded for hosting/convenience. No cloud deployment of application services (no Vercel etc.).

---

## 14. Five-state capability classification — R-CLASS-01 … R-CLASS-03

Living matrix in `docs/CAPABILITY_PARITY_MATRIX.md`: every capability is exactly one of **REAL / HARDWARE-DEPENDENT / SIMULATED / DEFERRED / PROHIBITED**, with sources and reasoning. No capability disappears without explanation (scope/deferral rules, `docs/05`). Simulation modules display a permanent SIMULATION state and are never confusable with live telemetry.

---

## 15. Operations, delivery, verification — R-VER-01 … R-VER-04

- One-command local dev startup where practical; Docker Compose for local infra; native macOS dev + production builds; packaged macOS app; local browser access; DB migrations; seeded simulation scenarios; backup/restore/uninstall; diagnostics; health checks; logs; license + dependency inventory; SBOM.
- After each phase: launch the full built/packaged system and verify end-to-end (not unit tests alone); record failures, fix, re-run.
- Never declare a feature complete because the UI renders — verify underlying behavior.
- Phase gates and check-in triggers per `docs/06`; session continuity per `docs/07`.

---

## 16. Out of scope / prohibited (permanent)

See §6.3 and the PROHIBITED rows of the parity matrix: autonomous weapons and targeting; unauthorized access/hacking of third-party or government systems; covert surveillance; undisclosed impersonation; actor-voice cloning; medical diagnosis presented as fact; true empty-air holography claims; hidden persistence; disabling safety mechanisms.
