"""Typed, replaceable speech-engine contracts (R-VOICE-12).

Every engine is an open-source component behind one of these protocols; a
different engine = a different adapter, no caller changes. Simulators (if any)
implement the same contracts and mark provenance as SIMULATION (R-CLASS-02).
Audio convention throughout: mono float32 PCM in [-1, 1].
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Iterable, Protocol

import numpy as np


@dataclass(frozen=True)
class WakeEvent:
    keyword: str
    confidence: float
    at_sample: int


class WakeWordEngine(Protocol):
    sample_rate: int

    def push(self, pcm: np.ndarray) -> list[WakeEvent]:
        """Feed a PCM frame; return any wake detections in that frame."""
        ...

    def reset(self) -> None: ...


@dataclass(frozen=True)
class VadFrame:
    is_speech: bool
    probability: float
    at_sample: int


class VadEngine(Protocol):
    sample_rate: int
    frame_samples: int

    def push(self, pcm: np.ndarray) -> list[VadFrame]: ...
    def reset(self) -> None: ...


@dataclass(frozen=True)
class SttPartial:
    text: str
    is_final: bool
    at_ms: float


class SttEngine(Protocol):
    sample_rate: int

    def push(self, pcm: np.ndarray) -> list[SttPartial]: ...
    def finalize(self) -> SttPartial: ...
    def reset(self) -> None: ...


@dataclass(frozen=True)
class TtsChunk:
    pcm: np.ndarray
    sample_rate: int
    """Engine that produced it + voice id — provenance travels with audio."""
    engine: str
    voice: str


class TtsEngine(Protocol):
    engine_id: str
    local: bool
    """local=False engines are egress-gated: refused in offline mode (R-LOC-02)."""

    def synthesize(self, text: str, voice: str, speed: float = 1.0) -> Iterable[TtsChunk]:
        """Yield audio chunks as they become available (sentence-level or better)."""
        ...

    def voices(self) -> list[str]: ...


class StreamingTtsEngine(TtsEngine, Protocol):
    async def synthesize_stream(
        self, text_stream: AsyncIterator[str], voice: str
    ) -> AsyncIterator[TtsChunk]: ...
