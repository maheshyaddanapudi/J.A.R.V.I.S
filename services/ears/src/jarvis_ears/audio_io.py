"""Audio I/O hardware-abstraction layer (R-VOICE-12, honesty rule).

The microphone and speakers are hardware, so audio device access sits behind a
typed contract with interchangeable adapters:

  - BufferAudioSource / BufferAudioSink — in-memory; drive the pipeline from a
    wav or array with no device. Real audio, deterministic, fully testable; this
    is what /voice-turn and the tests use.
  - PortAudioSource / PortAudioSink — real device capture/playback via
    sounddevice (PortAudio; MIT). Cross-platform, works on the Mac for the
    push-to-talk path. NO echo cancellation.
  - macOS VPIO adapter — the echo-cancelled capture used for barge-in lives in
    the Swift audio unit inside the Tauri companion (apps/companion/swift/),
    streaming PCM to this service over the same frame protocol. It implements
    the SAME contract; it just can't run in this Linux container.

Convention everywhere: mono float32 PCM in [-1, 1] at `sample_rate`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator, Protocol

import numpy as np


class AudioSource(Protocol):
    sample_rate: int

    def frames(self, frame_samples: int) -> Iterator[np.ndarray]:
        """Yield successive PCM frames until the source is exhausted/stopped."""
        ...

    def close(self) -> None: ...


class AudioSink(Protocol):
    sample_rate: int

    def play(self, pcm: np.ndarray) -> None: ...
    def stop(self) -> None:
        """Interrupt playback immediately (barge-in / emergency stop)."""
        ...


class BufferAudioSource:
    """Feeds a fixed PCM buffer as frames — the in-container/test capture path."""

    def __init__(self, pcm: np.ndarray, sample_rate: int = 16000) -> None:
        self.sample_rate = sample_rate
        self._pcm = pcm.astype(np.float32)
        self._stopped = False

    @classmethod
    def from_wav(cls, path: Path, target_rate: int = 16000) -> "BufferAudioSource":
        import soundfile as sf

        pcm, sr = sf.read(str(path), dtype="float32")
        if pcm.ndim > 1:
            pcm = pcm.mean(axis=1)
        if sr != target_rate:
            n = int(len(pcm) * target_rate / sr)
            pcm = np.interp(np.linspace(0, len(pcm) - 1, n), np.arange(len(pcm)), pcm).astype(
                np.float32
            )
        return cls(pcm, target_rate)

    def frames(self, frame_samples: int) -> Iterator[np.ndarray]:
        for i in range(0, len(self._pcm), frame_samples):
            if self._stopped:
                return
            yield self._pcm[i : i + frame_samples]

    def close(self) -> None:
        self._stopped = True


class BufferAudioSink:
    """Accumulates played PCM in memory; `stop()` truncates (barge-in test)."""

    def __init__(self, sample_rate: int = 24000) -> None:
        self.sample_rate = sample_rate
        self._chunks: list[np.ndarray] = []
        self._stopped = False

    def play(self, pcm: np.ndarray) -> None:
        if not self._stopped:
            self._chunks.append(pcm.astype(np.float32))

    def stop(self) -> None:
        self._stopped = True

    @property
    def played(self) -> np.ndarray:
        return np.concatenate(self._chunks) if self._chunks else np.zeros(0, dtype=np.float32)


def resample(pcm: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    if src_rate == dst_rate:
        return pcm.astype(np.float32)
    n = int(len(pcm) * dst_rate / src_rate)
    return np.interp(np.linspace(0, len(pcm) - 1, n), np.arange(len(pcm)), pcm).astype(np.float32)


def try_portaudio_source(sample_rate: int = 16000):
    """Construct a real-device source if PortAudio/sounddevice is available.

    Returns None (never raises) when there's no audio device or the library is
    absent — so callers can fall back to a buffer source. On the Mac with a mic
    this yields real capture (no echo cancellation; use the VPIO Swift adapter
    for barge-in)."""
    try:
        import sounddevice as sd  # noqa: F401
    except Exception:
        return None
    try:
        return _PortAudioSource(sample_rate)
    except Exception:
        return None


class _PortAudioSource:
    def __init__(self, sample_rate: int = 16000) -> None:
        import sounddevice as sd

        self.sample_rate = sample_rate
        self._sd = sd
        self._stream = None

    def frames(self, frame_samples: int) -> Iterator[np.ndarray]:
        with self._sd.InputStream(
            samplerate=self.sample_rate, channels=1, dtype="float32", blocksize=frame_samples
        ) as stream:
            self._stream = stream
            while True:
                data, _ = stream.read(frame_samples)
                yield data[:, 0]

    def close(self) -> None:
        if self._stream is not None:
            self._stream.close()
