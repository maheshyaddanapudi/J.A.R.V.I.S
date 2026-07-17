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

## Mac part of slice 1.3 (next)
Streaming STT (Kyutai MLX primary, whisper.cpp re-scorer, WhisperKit option),
echo-cancelled capture via Swift Voice Processing I/O in the Tauri companion,
barge-in (VAD during TTS playback → duck+stop), latency metrics (R-VOICE-09),
expressive-TTS listening test (Kyutai TTS / CSM / Chatterbox / OpenAI fable)
to fix the voice identity (D-0004a).

## Commands
`uv venv .venv && VIRTUAL_ENV=$PWD/.venv uv pip install -e ".[dev]"` ·
`python scripts/fetch_models.py` · `pytest` (skips loudly without models) ·
`uvicorn jarvis_ears.server:app --app-dir src --port 4170`

Resume pointer: `docs/IMPLEMENTATION_PLAN.md` → Current state.
