# RESEARCH_VERIFICATION — Phase 0 platform & dependency verification

**Verification date: 2026-07-16.** All claims below were verified against live official sources (vendor docs, repos, package registries) on this date unless explicitly flagged `[SECONDARY]` or `[UNVERIFIED]`. This document backs the sourced claims in `CAPABILITY_PARITY_MATRIX.md`, `ARCHITECTURE.md`, and `DECISION_LOG.md`. Re-verify per R-SPA-03 / R-HW-02 before each implementing phase.

---

## 1. Spatial platforms — input & privacy APIs

### 1.1 Apple Vision Pro / visionOS
- **Current:** visionOS 26 shipping (released 2025-09-15); visionOS 27 announced WWDC 2026-06-08, GA expected fall 2026.
- **Raw gaze: NOT available to third-party apps.** Apple HIG "Eyes": visionOS "doesn't provide direct information about where people are looking before they tap." Interaction model is **look-and-pinch** (system resolves gaze internally, delivers discrete gesture events); **hover effects render out-of-process** so apps cannot use them as a gaze side-channel. visionOS 26 "look to scroll" is likewise system-mediated. (developer.apple.com/design/human-interface-guidelines/eyes)
- **Hand tracking:** ARKit `HandTrackingProvider` — full hand skeleton; requires user authorization + `NSHandsTrackingUsageDescription`. 30 Hz on visionOS 1; display-rate (~90 Hz) with prediction since visionOS 2 `[SECONDARY: roadtovr/uploadvr]`. (developer.apple.com/documentation/arkit/handtrackingprovider)
- **Camera/passthrough pixels: Enterprise APIs only** — managed entitlements (`main-camera-access`, `camera-region`, passthrough-in-screen-capture, barcode detection, shared coordinate space, etc.) with Apple-approved license files; **in-house/ABM distribution only, no App Store**. Consumer apps get rendered passthrough + ARKit abstractions, never pixels. (developer.apple.com/documentation/visionos/building-spatial-experiences-for-business-apps-with-enterprise-apis)
- **Scene understanding:** `WorldTrackingProvider` (world anchors), `PlaneDetectionProvider`, `SceneReconstructionProvider` (mesh), `ImageTrackingProvider`, `ObjectTrackingProvider`, `RoomTrackingProvider` (room anchors), `EnvironmentLightEstimationProvider`; world-sensing needs its own permission. visionOS 26: Spatial Accessories (PSVR2 Sense controllers, Logitech Muse) via GameController + `AccessoryTrackingProvider`; spatial Personas out of beta; nearby same-room SharePlay.
- **Architecture consequence (binding, docs/03):** core interaction model uses look-and-pinch/hover/gestures only; raw gaze use would require an explicit current API + approval — none exists today for third-party apps.

### 1.2 Meta Quest 3 / 3S / Horizon OS
- **Current:** Horizon OS renumbered — last classic v85 (2026-01); Horizon OS 2.1 (2026-02), 2.5 rolling out from 2026-06-22 `[Wikipedia/Meta release notes]`.
- **Hand tracking:** full skeleton via Meta SDKs + OpenXR (`XR_EXT_hand_tracking`, `XR_FB_hand_tracking_*`); Wide Motion Mode, Fast Motion Mode (60 Hz), Capsense, Microgestures (SDK v74+). Policy: hand data may only be used for the feature itself. (developers.meta.com hand-tracking docs)
- **Eye tracking: Quest 3 and 3S have NO eye-tracking hardware.** Quest-Pro-only APIs (abstracted gaze, runtime permission). Do not design for gaze on Quest 3/3S.
- **Passthrough Camera Access: GA for normal store apps** — forward RGB frames via Android Camera2 since v74 (Unity) / v83 (Unreal); permissions `android.permission.CAMERA` or `horizonos.permission.HEADSET_CAMERA`. (Contrast: Apple gates pixels to enterprise.)
- **Scene/anchors:** Scene API + MRUK (room layout, high-fidelity scene), Spatial Anchors + Shared Spatial Anchors, Space Sharing API.
- **Body/face:** IOBT + Generative Legs (Quest 3/3S); face via Audio-To-Expression (no inward cameras on 3/3S).
- **OpenXR:** Horizon OS runtimes fully conformant; OpenXR is Meta's recommended path; accepts OpenXR 1.1.x loaders.

### 1.3 OpenXR (Khronos)
- **Current spec: 1.1 (patch 1.1.61)** on the Khronos registry. 1.1 released 2024-04-15. `XR_EXT_hand_tracking` and `XR_EXT_eye_gaze_interaction` remain extensions (not core).
- **macOS: no official/vendor OpenXR runtime exists — Apple never joined the OpenXR WG.** Community items only: "OpenXR OSX" streaming runtime (experimental, May 2026), `ox` virtual-device runtime (testing only), Meta XR Simulator for Mac (dev simulator). **No production path drives a physical headset from macOS via OpenXR.**

### 1.4 WebXR (W3C)
- **WebXR Device API: Candidate Recommendation Draft 2026-06-09.** Hand Input Module Level 1: Working Draft (25 joints/hand, permission-gated, anonymization guidance). Anchors/plane-detection modules: drafts in maintenance mode (no stable TR shortnames — verified 404s).
- **Quest Horizon browser:** full WebXR incl. hands and `immersive-ar` mixed reality; **no raw camera access in browser** (open feature request).
- **Vision Pro Safari:** WebXR on by default since visionOS 2; input via **`transient-pointer`** (input source appears only during pinch, ray from between the eyes at pinch time — **no continuous gaze ever exposed to web content**); skeletal hands behind separate permission. Safari `immersive-ar` support: `[UNVERIFIED either way as of 2026-07-16]`.
- **No raw-gaze module exists in WebXR on any mainstream implementation.**

### 1.5 Desktop hand tracking & display hardware (catalog seeds)
- **MediaPipe (google-ai-edge):** Apache-2.0; PyPI 0.10.35 (2026-04-27) with native Apple Silicon wheel; legacy "Hands" deprecated in favor of Tasks API `HandLandmarker` (21 landmarks) + `GestureRecognizer`.
- **Ultraleap Leap Motion Controller 2:** company broken up in 2025 (haptics/IP → SIM IP; Ultraleap → ROLI, Nov 2025). Hardware still sold at third-party distributors; Hyperion SDK lists Windows/macOS/Android; **proprietary license**; long-term support under ROLI **uncertain — flagged** for the hardware catalog.
- **Looking Glass (store, 2026-07-16):** Go 6" $99 (sold out at check); 16" light-field $3,000; 27" $10,000; new "Hololuminescent Display" line from ~$2,000 (16"–86", pre-order). Bridge service supports macOS 12+; Bridge SDK v2.4.10+ for custom renderers; Studio needs macOS 15+. (These are catalog entries; they do not define architecture — R-HW-01.)

## 2. Voice stack (all runnable locally on Apple Silicon)

**Recommended all-permissive chain** (final pick at voice check-in, D-0004): **sherpa-onnx keyword spotting** ("jarvis" defined as text; Apache-2.0) or **self-trained openWakeWord** model (training code Apache-2.0; note its *pre-trained* models incl. "hey jarvis" are CC-BY-NC-SA-4.0) → **Silero VAD v6.2.1** (MIT) → streaming STT: **Kyutai STT** `stt-1b-en_fr`/`2.6b-en` (code MIT/Apache-2.0, weights CC-BY-4.0; true token streaming, ~0.5 s delay, semantic VAD, official MLX) with **whisper.cpp v1.9.1** (MIT; Metal + CoreML) as high-accuracy re-scorer, or **WhisperKit v1.0** (MIT, CoreML/ANE, hypothesis+confirmed streams) on the Swift side → **Kokoro-82M** TTS (Apache-2.0; British male voices `bm_fable`/`bm_george`; ~180 ms synthesis on M-class via mlx-audio/kokoro-onnx MIT; synthetic style vectors — **not** clones of any actor) → **macOS Voice Processing I/O** (`AVAudioEngine.setVoiceProcessingEnabled` / `kAudioUnitSubType_VoiceProcessingIO`) for echo cancellation + barge-in (proprietary OS component, isolated in the Swift audio bridge per R-OSS-02; speexdsp BSD-3-Clause as the cross-platform fallback; browser path gets WebRTC AEC3 via `getUserMedia`) → **miniaudio** (public-domain/MIT-0) or **cpal** (Apache-2.0) for routing.
- Speaker verification: **sherpa-onnx speaker-embedding runtime** (Apache-2.0) with 3D-Speaker/WeSpeaker ONNX models (Apache-2.0); SpeechBrain ECAPA (Apache-2.0) as PyTorch alternative (VoxCeleb training-data terms fine for personal use).
- Rejected/flagged: Porcupine (proprietary engine/AccessKey; ships `jarvis_mac.ppn` but 3-user free cap), Piper successor `piper1-gpl` (GPL-3.0; quality below Kokoro — usable fallback, copyleft flagged per docs/03), XTTS-v2 (CPML non-commercial), F5-TTS weights (CC-BY-NC), Orpheus (no British voice; GPU-heavy), Chatterbox (MIT but British only via cloning — actor-clone risk; watermarked output), Dia (no macOS), Snowboy (dead), TEN VAD (non-OSI non-compete clause), faster-whisper (no Metal on macOS — CPU only).
- **Ducking note:** macOS has no public API to duck *other apps'* audio; we duck our own TTS on barge-in (sufficient), and VPIO echo cancellation removes the recognition-side need.

## 3. Local LLM runtimes & models
- **Ollama** MIT, v0.32.1 (2026-07-16); on Apple Silicon now runs an **MLX engine** (llama.cpp→MLX switch ~v0.19, `[SECONDARY]`); GUI app had a closed-source episode Jul–Nov 2025 `[SECONDARY]` — CLI/server remain MIT. Flagged for provenance awareness; acceptable as the Ollama-compatible endpoint the binding docs require.
- **llama.cpp** MIT, rolling build b10052 (2026-07-16); Apple Silicon first-class (NEON/Accelerate/Metal).
- **MLX** MIT v0.32.0 / **mlx-lm** MIT v0.31.3 — the de-facto Mac inference substrate in 2026 (also backs Ollama-on-Mac and vllm-metal).
- **vLLM** Apache-2.0 v0.25.1; macOS native is experimental CPU-only, but **vllm-metal** (Apache-2.0, official community plugin, MLX backend, OpenAI-compatible server) is viable on Apple Silicon (nightlies v0.3.0.dev).
- **LM Studio:** proprietary freeware (flagged; not used in core).
- **Model set that fits 128 GB (4-bit ≈ params × 0.5 B):** see DECISION_LOG D-0012 — Qwen3.6-35B-A3B (Apache-2.0, ~18 GB), Gemma 4 26B-A4B (Apache-2.0, multimodal, ~14 GB), gpt-oss-120b (Apache-2.0, MXFP4 ≈ 61–80 GB), Qwen3.5-122B-A10B (Apache-2.0, ~61 GB), Mistral Small 4 119B-A6B (Apache-2.0, ~60 GB, multimodal). Too big / rejected: DeepSeek-V4-Flash 284B (~142 GB), GLM-5.x ~750B, Kimi K2.6 1.06T (modified MIT), Qwen3.5-397B. Llama 4: non-OSI community license, superseded. All licenses HF-verified 2026-07-16.

## 4. Gateway, agent runtime, MCP
- **LiteLLM:** MIT core with `enterprise/` commercial carve-out; PyPI 1.92.0; supports Anthropic/OpenAI/Gemini/Ollama with streaming + tool calling. **Security history flagged:** March 2026 PyPI supply-chain incident (compromised 1.82.7/1.82.8, ~40 min), CVE-2026-42208 (SQLi), CVE-2026-42271 (MCP endpoint command injection, exploited), CVE-2026-35030 (JWT bypass); ~16 CVEs 2024–2026. → D-0008: own thin adapter layer; LiteLLM optional + pinned.
- **Self-hosted gateway alternates:** Portkey (MIT), Bifrost (Apache-2.0), Envoy AI Gateway (Apache-2.0), TensorZero (Apache-2.0); Helicone AI Gateway **GPL-3.0 (flag; README/LICENSE inconsistent)**.
- **LangGraph:** MIT, PyPI 1.2.9, 1.0 GA 2025-10-22, model-agnostic, no-breaking-changes commitment until 2.0. **Pydantic-AI:** MIT, 2.11.0, model-agnostic. **OpenAI Agents SDK:** MIT 0.18.2, OpenAI-centric defaults. **Claude Agent SDK:** Python wrapper MIT but TS SDK + bundled runtime under Anthropic Commercial ToS; Claude models only — not provider-neutral (rejected for core).
- **MCP:** current spec **2025-11-25** (OAuth 2.1 RS model, RFC 9728 + RFC 8707 MUSTs, PKCE S256 MUST, CIMD; security-best-practices page covers confused deputy, token passthrough forbidden, session hijacking, sandboxing local servers). Governance: donated to Linux Foundation **Agentic AI Foundation** (2025-12-09); repos relicensing MIT→Apache-2.0. SDKs: TS 1.29.0 (MIT), Python `mcp` 1.28.1 (MIT). Registry still preview (API freeze v0.1). Tool-poisoning literature: Invariant Labs TPA disclosure (Apr 2025), MCPTox (arXiv 2508.14925). Unreleased draft spec (stateless MCP, deprecating Roots/Sampling/Logging) — **do not build against draft** (D-0011).

## 5. Data layer
- **PostgreSQL 18** (18.4 current; PostgreSQL License). **pgvector v0.8.5** (PostgreSQL License; HNSW + IVFFlat; `halfvec`/`sparsevec`; iterative scans; PG13–18). **pgvectorscale 0.9.0** (PostgreSQL License; StreamingDiskANN; TigerData née Timescale — no acquisition found).
- **SQLCipher 4.17.0** (BSD-3-style, Zetetic; community edition) — candidate for a small encrypted local store if ever needed; core stays Postgres.
- **pgsodium v3.1.11** (BSD-3-style) — alive but Supabase marks it "pending deprecation" and pulled TCE from its UI → not a core dependency (D-0013). **Percona pg_tde 2.2.1** (PostgreSQL License) — GA full-TDE option if desired later.
- **Valkey 9.1.0** (BSD-3-Clause, Linux Foundation). Redis ≥8.0 tri-license RSALv2/SSPLv1/AGPLv3 — avoided (D-0007).

## 6. Desktop shell, web/3D
- **Tauri 2**: 2.11.5 (MIT OR Apache-2.0); tray-icon core feature; official plugins global-shortcut 2.3.2, autostart 2.5.1, positioner 2.3.3, notification 2.3.3 (all dual-licensed); no official accessibility plugin (community: tauri-plugin-macos-permissions-api, MIT) — our own Swift bridge covers AX. **Electron 43.1.1** (MIT) rejected for weight.
- **Next.js 16.2.10** (MIT; 16.3 still preview), **React 19.2.7** (MIT), **Three.js r185** (MIT; WebGPURenderer production-ready with WebGL2 fallback; WebGPU Baseline across browsers incl. Safari 26), **@react-three/fiber 9.6.1** (MIT, React 19 line), **drei 10.7.7** (MIT).

## 7. Automation, observability
- **Playwright 1.61.1** (Apache-2.0). **OpenTelemetry**: JS API 1.9.1 / SDK 2.9.0 (sdk-node still 0.2xx experimental), Python SDK 1.44.0 (all Apache-2.0); traces+metrics stable, logs still "Development".
- **Trace viewer:** **Jaeger v2.19.0** (Apache-2.0, CNCF, all-in-one container, natively an OTel Collector distro) — pick (D-0010). Lightweight alternates: otel-desktop-viewer v0.3.2, otel-tui v0.7.3 (both Apache-2.0). **AGPL-flagged:** Grafana 13.1.0, Loki 3.7.3, Tempo 3.0.2, Mimir 3.1.3, OpenObserve 0.91.1, and the docker-otel-lgtm image by contents. SigNoz core MIT but default distribution bundles `ee/`-licensed code — flagged.

## 8. Smart home (Phase 5)
- **Home Assistant 2026.7.2** (Apache-2.0; Open Home Foundation governance since Apr 2024). **Mosquitto 2.1.2** (EPL-2.0 OR EDL-1.0/BSD-3-Clause-equivalent). **Matter SDK v1.5.1.0** (Apache-2.0; spec 1.5.1, 2026-03-31; shipping *certified* products needs CSA membership — not relevant for personal integration). **zigbee2mqtt 2.12.1** — **GPL-3.0 flagged**; contained as a standalone daemon over MQTT (no linking), which docs/03 permits surfacing: it would run as an isolated service, never linked into core; decision deferred to Phase 5 check-in.

## 9. macOS control surface (Phase 2)
- **macOS 26 "Tahoe"** current (26.5.2); macOS 27 announced WWDC 2026 (Apple Silicon only, fall 2026).
- **AXUIElement / AXUIElementPerformAction / AXIsProcessTrustedWithOptions:** available since 10.2/10.9, **no deprecation flags** (Apple doc JSON); still the only OS-level UI-tree control surface. TCC Accessibility permission required.
- **ScreenCaptureKit** (12.3+) + `SCScreenshotManager` (14+); `CGWindowListCreateImage` **obsoleted at macOS 15 SDK**. TCC pane now "Screen & System Audio Recording"; Sequoia-era periodic re-approval nags persist (monthly-ish; purple indicator during capture).
- **AppleScript/JXA:** still ship in Tahoe; maintenance mode; per-target Automation TCC. **Shortcuts CLI:** `shortcuts run|list|view|sign` current and documented. **WWDC26:** App Intents now mandatory Siri surface (SiriKit deprecated); no public "control other apps" agent API — AX remains it.
- **Input synthesis:** CGEventPost (native, requires Accessibility grant) — chosen; nut.js (paid/dormant — flagged), robotjs (MIT, revived 2026 but 6-year gap), pyautogui (BSD-3, unmaintained) rejected.
- **OSS computer-use bridges surveyed:** trycua/cua (MIT, very active — reference material), browser-use/macOS-use (MIT, dormant), screenpipe (now proprietary license — flagged), Open Interpreter (pivoted), anthropic computer-use-demo (MIT, reference), apple-mcp (archived; peakmojo/applescript-mcp MIT alive). We build our own minimal bridge (D-0015); these serve as prior art only.

---

## Verification caveats (explicitly not fully verified)
- visionOS 2 hand-tracking 90 Hz figure; Ollama MLX-switch timing and GUI-source episode — secondary sources.
- Safari visionOS `immersive-ar`: could not verify either way.
- parakeet-mlx code license; per-model licenses in sherpa-onnx model zoos; py-webrtcvad exact license; Porcupine offline behavior after key activation; cliclick 5.1 release date.
- These items must be re-checked before any dependent decision.
