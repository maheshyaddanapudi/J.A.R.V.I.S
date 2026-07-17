# ARCHITECTURE — J.A.R.V.I.S.

**Status:** DRAFT — **architecture option must be selected by the user at the Phase 0 check-in** (DECISION_LOG D-0002)
**Generated:** 2026-07-16 · All component versions/licenses verified 2026-07-16 (`docs/RESEARCH_VERIFICATION.md`).

---

## 1. Forces every option must satisfy

From the binding docs: honesty rule (R-CORE-02); local-first + full offline path (R-MODEL-04, R-LOC); provider-neutral gateway (R-MODEL-02); replaceable open-source components for every engine (R-VOICE-12, R-OSS); typed registries + MCP-first extensibility (R-CAP-01/02); two-stage self-extension with structural hard limits (R-CAP-04…08); approval/audit/emergency-stop in the smallest possible trust core (R-AUTO, R-SEC); Postgres+pgvector memory (R-MEM-02); cinematic web-grade UI + future XR clients on a shared Spatial Scene Service (R-UI, R-SPA); macOS-native control bridges isolated behind adapters (R-CTRL, R-OSS-02); justify every process (docs/04).

Platform facts constraining all options (verified 2026-07-16): third-party visionOS apps get no raw gaze; Quest 3/3S have no eye tracking; no production OpenXR runtime exists on macOS; Kyutai/whisper.cpp/Kokoro/sherpa-onnx give a fully-local permissive voice chain; MLX is the Mac inference substrate; AXUIElement + CGEvent + ScreenCaptureKit + Shortcuts remain the sanctioned macOS control surface.

## 2. Common shape (all three options)

```
┌────────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                               │
│  Command Center (browser, Next.js+R3F) · Voice Orb + menu bar (Tauri)  │
│  later: iPhone/Watch/visionOS (Swift), Quest/OpenXR, WebXR             │
├────────────────────────────────────────────────────────────────────────┤
│  KERNEL (Z1+Z2)                                                        │
│  policy engine · approval broker · audit writer (hash-chained)         │
│  credential broker (Keychain) · emergency stop  ── Z1, protected paths │
│  orchestrator/agent runtime · planner · model gateway · memory service │
│  registries (tools/agents/skills/…): typed, versioned                  │
├────────────────────────────────────────────────────────────────────────┤
│  EXECUTORS (Z3/Z4, isolated processes)                                 │
│  speech pipeline · macOS bridge (AX/CGEvent/SCK/Shortcuts, Swift)      │
│  browser automation (Playwright) · terminal-with-policy                │
│  MCP client host (per-server sandboxes) · generated capabilities (P3)  │
├────────────────────────────────────────────────────────────────────────┤
│  STATE                                                                 │
│  PostgreSQL 18 + pgvector (memory, audit, registries, tasks)           │
│  macOS Keychain / encrypted vault (secrets) · local artifact store     │
│  Ollama (local models) · OTel → Jaeger v2 (local)                      │
└────────────────────────────────────────────────────────────────────────┘
```

- Everything binds to localhost; browser UI authenticated even locally (T9).
- Z1 components live in one privileged module with protected paths no generated code can touch (T3).
- Every executor speaks a typed contract; simulators implement the same contracts (R-CORE-02).
- The differences between options are **which runtimes host the kernel and executors**.

---

## 3. Option A — Hybrid core: TypeScript platform + Python intelligence runtime (RECOMMENDED)

The suggested stack from docs/04, made concrete.

| Layer | Choice (license) |
|---|---|
| Monorepo | pnpm + Turborepo, TypeScript; `uv` for Python packages |
| Kernel platform (Z1 + registries + audit + policy + gateway) | **Node.js/TypeScript service** (`jarvisd`) — one process, owns Postgres, WebSocket/SSE to clients |
| Agent runtime (Z2) | **Python FastAPI service** (`jarvis-mind`) with **LangGraph 1.x** (MIT) behind our own `AgentRuntime` interface (D-0009) |
| Model gateway | Our thin adapter layer in the kernel (Anthropic / OpenAI-compat / Gemini / Ollama), neutral message schema (D-0008) |
| Speech | **Python speech daemon** (`jarvis-ears`): sherpa-onnx KWS/openWakeWord, Silero VAD, Kyutai-MLX / whisper.cpp STT, Kokoro TTS — plus a **small Swift audio unit inside the Tauri app** for Voice Processing I/O echo cancellation and capture (barge-in) |
| macOS companion | **Tauri 2** app: orb UI, menu bar, global hotkeys, notifications, e-stop; hosts the **Swift bridge** (AX, CGEvent, ScreenCaptureKit, Shortcuts, Keychain) |
| Command Center | Next.js 16 + React 19 + Three.js r185/R3F 9 (WebGPU with WebGL2 fallback), served locally |
| State | Postgres 18 + pgvector 0.8.5 (Docker Compose); Valkey deferred (D-0006) |
| Observability | OTel JS+Python → Jaeger v2 all-in-one (local) |

**Why it fits:** ML/speech/agents live where their ecosystems are strongest (Python: MLX, sherpa-onnx, LangGraph, MCP Python SDK); the always-on platform, registries, policy, UI transport live in one long-lived TS process that shares types end-to-end with the web UI; macOS-specific code is isolated in one Swift bridge (replaceable adapter per R-OSS-02).

**Process inventory (justified, Phase 1):** Tauri app (must exist for native UX/permissions) · `jarvisd` kernel (must exist: trust core + transport) · `jarvis-mind` (Python: model/speech ecosystems demand it) · `jarvis-ears` (real-time audio isolation — a stalled agent loop must never glitch audio) · Postgres (required by binding docs) · Ollama (local models) · Jaeger (dev observability, optional at runtime). Nothing else.

**Tradeoffs:** two application languages (TS + Python) = two toolchains, duplicated schema types (mitigated: JSON-Schema/OpenAPI-generated types, single-source contracts); IPC hop between kernel and mind (mitigated: localhost WebSocket/HTTP2, streaming); more moving parts than B/C but each is small and replaceable.

## 4. Option B — Single-runtime TypeScript core

Everything from Option A except: agent runtime is **LangGraph.js** (or a custom TS graph) inside `jarvisd`; speech runs via **sherpa-onnx Node bindings** + whisper.cpp/Kokoro through native addons; no Python anywhere.

**Pros:** one language, one process fewer, shared types for free, simplest debugging story.
**Cons (why not recommended):** the Mac-local ML ecosystem is Python/Swift-first — **no MLX from Node** (Kyutai streaming STT, mlx-audio Kokoro, parakeet-mlx all lose their best path), sherpa-onnx JS bindings trail its Python API, and Phase 3 self-extension will want to *generate* Python tools (dominant ecosystem for integrations/ML). Betting the intelligence layer on the weakest ecosystem contradicts "best replaceable OSS component per engine." Voice quality/latency (the soul of the product) takes the hit.

## 5. Option C — Swift-native core

Kernel + speech + bridge as one native Swift/SwiftUI app (VPIO, AX, SCK, Keychain all first-party); Postgres embedded via Docker; web Command Center kept for R3F; agents via a Swift actor runtime or embedded Python.

**Pros:** best possible audio path (VPIO in-process), tightest macOS integration and packaging, lowest idle footprint.
**Cons (why not recommended):** couples the **core** platform to proprietary OS frameworks — the binding docs require core orchestration/memory/agent/tool logic to stay open, portable, and adapter-isolated (R-OSS-02); agent/MCP/LLM ecosystems in Swift are the thinnest of the three; XR/browser/Linux-server expansion (docs/01 "expandable later") gets hardest; self-extension generating Swift into a signed app bundle is materially harder to sandbox and hot-manage than out-of-process plugins.

## 6. Voice stack recommendation (all options; final pick at voice check-in, D-0004)

| Engine | Pick (license) | Runner-up |
|---|---|---|
| Wake word "Jarvis" | **sherpa-onnx KWS**, keyword from text, Apache-2.0 | self-trained **openWakeWord** model (training code Apache-2.0) |
| VAD | **Silero VAD v6.2.1** (MIT) | WebRTC VAD as cheap pre-gate (BSD-3) |
| Streaming STT | **Kyutai STT 1B/2.6B via MLX** (code MIT/Apache-2.0, weights CC-BY-4.0; true streaming + semantic endpointing) | **WhisperKit** (MIT, ANE) in Swift path; **whisper.cpp** (MIT) as accuracy re-scorer; sherpa-onnx zipformer (Apache-2.0) as lightest |
| TTS (British, restrained, non-clone) | **Kokoro-82M** `bm_fable` / `bm_george` via kokoro-onnx (MIT) / mlx-audio (Apache-2.0 model) | Kyutai TTS VCTK voices (CC-BY-4.0, true streaming); `piper1-gpl` en_GB voices (GPL-3.0 — flagged) |
| Echo cancel / barge-in | **macOS Voice Processing I/O** in the Swift audio unit (proprietary OS API, adapter-isolated per R-OSS-02) + browser WebRTC AEC3 for web capture | speexdsp (BSD-3) cross-platform fallback |
| Speaker verification | **sherpa-onnx** + 3D-Speaker/WeSpeaker ONNX (Apache-2.0) | SpeechBrain ECAPA (Apache-2.0) |
| Audio I/O | **miniaudio** (public domain/MIT-0) or **cpal** (Apache-2.0, Rust side) | PortAudio (MIT-style) |

Latency budget (Phase 1 acceptance): wake→listening ≤ 500 ms; utterance-end→first audio ≤ 2.0 s (local `fast_conversation` model); barge-in stop ≤ 300 ms.

## 7. Recommendation

**Option A.** It is the only option that puts every subsystem in its strongest ecosystem while keeping the trust core small and the proprietary surface (Swift bridge, VPIO) behind replaceable adapters exactly as the binding docs demand. Option B sacrifices the voice experience and Phase-3 generation ecosystem to save one runtime; Option C sacrifices openness and portability of the core — both violate the spirit (and B arguably the letter) of R-OSS/R-VOICE-12. The two-language cost is real but bounded and mitigated by generated contracts.

**Decision requested at check-in:** A / B / C (or A with amendments).

## 8. Cross-cutting designs fixed regardless of option

1. **Neutral message/tool schema** at the gateway boundary; provider adapters are the only code that knows provider formats (R-MODEL-02).
2. **Typed contracts + permission manifests + risk classes** for every tool/adapter/simulator; simulators are the same contract with a `SIMULATION` provenance the UI renders permanently (R-CORE-02, R-CLASS-02).
3. **Policy engine order:** prohibited-list → scope check → risk class → approval state → rate/budget limits; every decision and action audited (hash-chained, T11); e-stop is a kernel-level latch every executor polls and every transport propagates < 1 s.
4. **Untrusted-content envelopes** with provenance labels from every external source, including tool descriptions and STT of ambient speech (T1/T2).
5. **Registries in Postgres** with semver + hash + provenance; capability installer (Z1) is the only writer for the generated-capability registry (Phase 3).
6. **Spatial Scene Service (Phase 6)** as its own service with per-device capability descriptors and honest display classes; clients render, never own, the scene (R-SPA-02/04).
7. **Offline mode** is a first-class config: gateway pins local providers, integrations disabled, egress monitor asserts zero outbound (Phase-1 acceptance).
8. **module CLAUDE.md** in every package from Phase 1 (D-0005), each stating its contracts, conventions, and pointer back to `IMPLEMENTATION_PLAN.md`.
