# jarvis-ears — module guide

Python speech service (architecture Option A): wake word, VAD, STT, TTS behind the
typed replaceable engine contracts in `src/jarvis_ears/engines.py` (R-VOICE-12).
Audio convention: mono float32 PCM in [-1,1]. Localhost only (R-LOC-01). Port 4170.

## Current state (slice 1.3, part 1 — container-verified 2026-07-17)
- **Wake**: `wake_openwakeword.py` — openWakeWord ONNX, phrase "hey jarvis"
  (pretrained model CC-BY-NC-SA-4.0 — flagged in license inventory; self-trained
  bare-"jarvis" model planned, D-0004). VERIFIED: detects Kokoro-spoken
  "Hey, Jarvis!", ignores unrelated speech (tests/test_engines.py).
  `wake_sherpa.py` (bare-"jarvis" KWS) is UNVERIFIED — assets need GitHub
  releases, blocked in the dev container; verify on Mac before enabling.
- **VAD**: `vad_silero.py` — Silero v6 ONNX (MIT), 512-sample frames + 64-sample
  context (required — omitting context silently kills accuracy).
- **TTS**: `tts_kokoro.py` — Kokoro-82M ONNX (Apache-2.0), en-gb voices
  bm_fable/george/daniel/lewis, sentence-chunked. `tts_openai.py` — OPTIONAL
  remote adapter (D-0004a): key-gated (`OPENAI_API_KEY`), refused in offline
  mode, style instructions for expressive delivery. UNVERIFIED against the live
  API (no key in dev container) — verify on Mac with the user's key if configured.
- **API**: GET /health (real engine states; STT honestly reported not-loaded),
  POST /tts, WS /listen (wake + VAD events with sample offsets).
- Models fetched by `scripts/fetch_models.py` into `JARVIS_EARS_MODELS`
  (default /tmp/jarvis-ears-models); nothing is bundled in git.

## Slice 1.3 part 2 ✅ (container-verified 2026-07-17)
- **Streaming STT**: `stt_sherpa.py` — sherpa-onnx streaming zipformer en
  2023-06-26 (Apache-2.0, CPU, runs identically in-container and on Mac).
  Partial + final hypotheses, endpoint detection, accumulates across endpoints.
  Verified: real TTS→STT round trip; transcribed "Jarvis remind me to call
  Pepper at noon" perfectly, ~15× realtime on CPU. On Mac a Kyutai-MLX /
  WhisperKit adapter can swap in behind the same SttEngine contract.
- **Full voice round-trip** (`/voice-turn`): audio → STT → kernel `/core/converse`
  (the real gated loop with audit + memory) → TTS audio out. Verified end-to-end:
  spoken command transcribed, reasoned, answered in real synthesized speech, and
  the turn persisted to conversation memory. (`/transcribe` and STT-in-`/listen`
  also added.)
- **Turn-taking / barge-in**: `turn_taking.py` — engine-neutral state machine
  (IDLE/LISTENING/THINKING/SPEAKING/BARGED_IN); barge-in fires on sustained
  speech during playback (<=200ms), ignores coughs; utterance start/end from
  VAD. Fully tested. 9 ears tests pass.

## Audio I/O HAL (`audio_io.py`) — added 2026-07-17
The mic/speakers are hardware, so audio device access is behind a typed contract
(AudioSource/AudioSink): `BufferAudioSource/Sink` (in-memory, real audio,
fully tested — the /voice-turn + test path), `try_portaudio_source` (real device
via sounddevice/PortAudio, works on Mac for push-to-talk, no AEC), and the
**macOS VPIO adapter** = the Swift bridge in `apps/companion/swift/` (echo-
cancelled capture+playback; source complete, builds on Mac). 4 audio_io tests.

## Offline path verified (AT1.12, 2026-07-17)
Full voice-turn ran with `JARVIS_OFFLINE=1`: remote provider disabled, wake/STT/
TTS all local ONNX on CPU, local model via llama.cpp — **zero external network
connections** during the turn (verified via /proc/net/tcp before/after). The
entire voice loop runs fully offline.

## Mac-only remainder of slice 1.3
Live mic/speaker *device* binding + VPIO echo cancellation (the Swift bridge
source is written; `swift run JarvisAudio` on the Mac). Expressive-TTS listening
test to fix the voice identity (D-0004a). Real-audio latency metrics (R-VOICE-09).
Everything else in the voice pipeline is real and verified in-container.

## Commands
`uv venv .venv && VIRTUAL_ENV=$PWD/.venv uv pip install -e ".[dev]"` ·
`python scripts/fetch_models.py` · `pytest` (skips loudly without models) ·
`uvicorn jarvis_ears.server:app --app-dir src --port 4170`

Resume pointer: `docs/IMPLEMENTATION_PLAN.md` → Current state.
