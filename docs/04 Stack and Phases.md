# 04 — Suggested Stack and Phase Roadmap

## Suggested stack (present options at the architecture check-in before committing)
TypeScript monorepo (pnpm); Next.js + React + Three.js + React-Three-Fiber; Tauri 2 (+ Rust, Swift/SwiftUI bridges); OpenXR/WebXR; a Python agent runtime (FastAPI) with an open-source stateful graph runtime such as LangGraph, isolated behind our own interfaces so it can be replaced; MCP TypeScript + Python SDKs; PostgreSQL + pgvector; Valkey (not Redis) where a cache/queue is needed; durable local task persistence; WebSockets/WebRTC/SSE; Home Assistant + MQTT (later); Docker Compose; OpenTelemetry with a local open-source viewer; Playwright; open-source CV/gesture/audio/3D libraries. Justify every process and datastore; add nothing because it's fashionable. Keep the core modular enough to replace the agent framework, model provider, memory/vector engine, speech engine, smart-home platform, browser-automation engine, 3D renderer, hardware integration, OS client, XR runtime, projection/volumetric/light-field systems, camera, hand tracker, and policy engine. Recommend concrete open-source picks (with licenses) for the wake word ("jarvis"), streaming STT, British TTS, VAD/barge-in, and speaker verification.

## Phases (build complete vertical slices; sequence work, do not permanently remove requirements)

**Phase 0 — Research & Architecture (NO production code yet):** inspect the repo; research J.A.R.V.I.S. capabilities and interface behavior; verify the current official input/privacy APIs for each spatial platform; then CREATE and get my approval for docs/PRODUCT_SPEC.md (the full detailed specification — every interface, the complete spatial-room and hardware requirements, device abstractions, memory types, security requirements, and all definitions-of-done), docs/CAPABILITY_PARITY_MATRIX.md (five-state, sourced), docs/ARCHITECTURE.md (with 2–3 options, a recommendation, and tradeoffs), docs/THREAT_MODEL.md, docs/IMPLEMENTATION_PLAN.md (living: current phase, current slice, approved decisions, deferred items, risks, acceptance tests, hardware prerequisites), docs/DECISION_LOG.md, root and module-level CLAUDE.md files (capturing the approved architecture, conventions, and the pointer to resume from docs/IMPLEMENTATION_PLAN.md so a fresh session picks up in-place instead of re-deciding settled questions), and docs/REQUIREMENTS_TRACEABILITY.md (mapping every non-negotiable requirement to its product-spec section, capability-parity entry, implementation phase, acceptance tests, current status, design decisions, and deferred/prohibited reasoning where applicable). No requirement may be omitted from the generated documents without being explicitly surfaced at the Phase 0 check-in. Verify dependencies and licenses. Check in before implementation.

**Phase 1 — Functional Core:** the end-to-end vertical slice — browser Command Center + macOS companion, "Jarvis" wake word, streaming voice conversation with barge-in, provider-neutral gateway with Ollama, one local STT + one local TTS + local embeddings, conversation memory, tool execution, approval flow, activity timeline, local audit log, one read-only tool, one reversible Mac action, automated tests, emergency stop.

**Phase 2 — Computer & Knowledge:** screen understanding, macOS accessibility control, browser automation, files, terminal, repo/document/image analysis, persistent encrypted memory, research with provenance, independent action verification, permission-scoped computer control.

**Phase 3 — Dynamic Agents & Self-Extension:** the registries, dynamic sub-agent/tool/skill/rule/workflow generation, and the two-stage sandboxed self-development pipeline (Stage A generation-without-activation and Stage B controlled activation) with its dedicated security check-in, versioning, and rollback — demonstrated end to end (detect → research → design → generate → test → security-scan → review → approve → install → use → verify → roll back).

**Phase 4 — Communications & Proactivity** (including proactive briefings).

**Phase 5 — Home & Hardware** (Home Assistant, device gateway, hardware catalog, plugin SDK, room model, Stark-residence simulator, real device support when available).

**Phase 6 — Workshop & shared Spatial Scene Service** (3D/CAD, digital twins, mouse+voice+gesture manipulation, multi-display, flat-screen 3D fallback, spatial-object persistence).

**Phase 7 — Quest & OpenXR clients.**

**Phase 8 — Projection-mapped room.**

**Phase 9 — Light-field & volumetric displays.**

**Phase 10 — HUD & mission systems** (+ armor/flight/robot/drone simulators, safe real-device plugins where hardware exists).

**Phase 11 — Apple ecosystem** (iPhone, Watch, Vision Pro; trusted local-network pairing; cross-device handoff).

**Phase 12 — Complete spatial room.**

**Phase 13 — Parity, hardening, optimization** (audit every capability against the matrix; replace temporary adapters where real hardware/integrations exist; security + prompt-injection + failure + recovery testing; validate backups/rollback; verify clean-install, offline, local-only, emergency-stop, and hardware-failure behavior).
