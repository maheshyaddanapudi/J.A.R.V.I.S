# J.A.R.V.I.S. macOS companion

The native macOS surface: the echo-cancelled acoustic path (Swift audio bridge)
and — later in Phase 1 slice 1.8 — the Tauri app shell (Voice Orb, menu-bar
emergency stop, global push-to-talk hotkey) that hosts it.

> **Build target: macOS (Apple Silicon).** The Swift audio bridge uses
> AVFoundation's Voice Processing I/O and can only be compiled/run on macOS. It
> is **not** compiled in the Linux dev container — the rest of the voice pipeline
> (wake, VAD, streaming STT, TTS, turn-taking, the full audio→reason→speech
> round-trip) already runs and is verified there; this supplies the real device
> I/O + echo cancellation that hardware requires.

## What's here now

- `swift/` — `JarvisAudio`, a SwiftPM executable that opens the real mic and
  speakers, enables **Voice Processing I/O** (Apple's AEC/NS/AGC, so the barge-in
  VAD hears you and not J.A.R.V.I.S.), captures 16 kHz mono float32 frames, and
  streams them to the `jarvis-ears` `/listen` WebSocket. Frame format matches the
  service exactly (raw little-endian float32).

## Run on the Mac

```bash
# 1) start the stack (kernel + gateway + ears) — see docs/DEVELOPMENT.md
make dev
python services/ears/scripts/fetch_models.py

# 2) build & run the audio bridge (grants Microphone TCC on first run)
cd apps/companion/swift
swift run JarvisAudio --ears ws://127.0.0.1:4170/listen
# say "hey jarvis" — the ears service emits wake/vad/partial/final events
```

Without this bridge you can still use the whole pipeline via push-to-talk / the
`/voice-turn` and `/transcribe` HTTP endpoints (buffer audio); this bridge adds
the always-listening, barge-in-capable live acoustic path.

## Next (slice 1.8)

Tauri 2 app shell (`src-tauri/`): tray + persistent emergency stop, global
push-to-talk shortcut, the Voice Orb window, and hosting this Swift bridge as a
sidecar. Then the packaged, signed `.app` and one-command launch.
