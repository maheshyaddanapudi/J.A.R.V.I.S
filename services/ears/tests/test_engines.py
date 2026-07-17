"""Engine tests against real models (no mocks — R-CORE-02).

Requires model assets in JARVIS_EARS_MODELS (default /tmp/jarvis-ears-models),
fetched by scripts/fetch_models.py. Tests skip loudly if assets are missing.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest

MODELS = Path(os.environ.get("JARVIS_EARS_MODELS", "/tmp/jarvis-ears-models"))

pytestmark = pytest.mark.skipif(
    not (MODELS / "kokoro" / "model.onnx").exists(),
    reason=f"model assets missing under {MODELS}; run scripts/fetch_models.py",
)


@pytest.fixture(scope="session")
def kokoro():
    from jarvis_ears.tts_kokoro import KokoroTts

    return KokoroTts(MODELS / "kokoro" / "model.onnx", MODELS / "kokoro" / "voices")


@pytest.fixture(scope="session")
def vad():
    from jarvis_ears.vad_silero import SileroVad

    return SileroVad(MODELS / "silero_vad.onnx")


@pytest.fixture(scope="session")
def wake():
    from jarvis_ears.wake_openwakeword import OpenWakeWord

    return OpenWakeWord(MODELS)


def _resample_24k_to_16k(pcm: np.ndarray) -> np.ndarray:
    # exact 3:2 rational resample via linear interpolation — fine for tests
    n_out = int(len(pcm) * 16000 / 24000)
    x_out = np.linspace(0, len(pcm) - 1, n_out)
    return np.interp(x_out, np.arange(len(pcm)), pcm).astype(np.float32)


def test_kokoro_synthesizes_real_audio(kokoro):
    chunks = list(kokoro.synthesize("Good morning, sir.", voice="bm_george"))
    assert chunks, "no audio produced"
    pcm = np.concatenate([c.pcm for c in chunks])
    assert len(pcm) > 24000 * 0.5  # at least half a second
    rms = float(np.sqrt((pcm**2).mean()))
    assert rms > 0.01, f"audio suspiciously quiet (rms={rms})"
    assert chunks[0].engine == "kokoro" and chunks[0].voice == "bm_george"


def test_vad_distinguishes_speech_from_silence(kokoro, vad):
    vad.reset()
    silence = np.zeros(16000, dtype=np.float32)
    silence_frames = vad.push(silence)
    assert silence_frames and not any(f.is_speech for f in silence_frames)

    speech_24k = np.concatenate(
        [c.pcm for c in kokoro.synthesize("Systems are fully operational today.", "bm_george")]
    )
    vad.reset()
    speech_frames = vad.push(_resample_24k_to_16k(speech_24k))
    speech_ratio = sum(f.is_speech for f in speech_frames) / len(speech_frames)
    assert speech_ratio > 0.5, f"VAD missed synthesized speech (ratio={speech_ratio:.2f})"


def test_wake_word_detects_spoken_hey_jarvis(kokoro, wake):
    """End-to-end: TTS speaks the wake phrase; the wake engine must detect it."""
    wake.reset()
    audio_24k = np.concatenate([c.pcm for c in kokoro.synthesize("Hey, Jarvis!", "bm_george")])
    pcm = _resample_24k_to_16k(audio_24k)
    pcm = np.concatenate([np.zeros(8000, dtype=np.float32), pcm, np.zeros(16000, dtype=np.float32)])
    events = []
    for start in range(0, len(pcm), 1280):  # stream in 80 ms frames like a mic
        events.extend(wake.push(pcm[start : start + 1280]))
    assert events, "wake engine did not detect spoken 'Hey Jarvis'"
    assert events[0].keyword == "hey jarvis"


def test_wake_word_ignores_other_speech(kokoro, wake):
    wake.reset()
    audio_24k = np.concatenate(
        [c.pcm for c in kokoro.synthesize("The weather in London is rather pleasant.", "bm_george")]
    )
    pcm = _resample_24k_to_16k(audio_24k)
    events = []
    for start in range(0, len(pcm), 1280):
        events.extend(wake.push(pcm[start : start + 1280]))
    assert not events, f"false wake on unrelated speech: {events}"
