"""Wake-word engine: openWakeWord ONNX pipeline.

Code: Apache-2.0 (dscripka/openWakeWord). NOTE: the pre-trained "hey jarvis"
model is CC-BY-NC-SA-4.0 — acceptable for this personal single-user system and
recorded in the license inventory; a self-trained bare-"jarvis" model (training
code Apache-2.0) replaces it later (D-0004). Wake phrase for now: "hey jarvis".
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from openwakeword.model import Model as OwwModel

from .engines import WakeEvent


class OpenWakeWord:
    sample_rate = 16000
    _CHUNK = 1280  # 80 ms — openWakeWord's native frame size

    def __init__(self, models_dir: Path, threshold: float = 0.5) -> None:
        d = Path(models_dir)
        self._model = OwwModel(
            wakeword_models=[str(d / "oww_hey_jarvis_v0.1.onnx")],
            melspec_model_path=str(d / "oww_melspectrogram.onnx"),
            embedding_model_path=str(d / "oww_embedding_model.onnx"),
            inference_framework="onnx",
        )
        self._threshold = threshold
        self._buffer = np.zeros(0, dtype=np.float32)
        self._samples_seen = 0
        self._armed = True  # re-arms after score drops below threshold

    def push(self, pcm: np.ndarray) -> list[WakeEvent]:
        events: list[WakeEvent] = []
        self._buffer = np.concatenate([self._buffer, pcm.astype(np.float32)])
        while len(self._buffer) >= self._CHUNK:
            frame = self._buffer[: self._CHUNK]
            self._buffer = self._buffer[self._CHUNK :]
            self._samples_seen += self._CHUNK
            # openWakeWord expects 16-bit int scale
            scores = self._model.predict((frame * 32767).astype(np.int16))
            score = float(max(scores.values()))
            if score >= self._threshold and self._armed:
                self._armed = False
                events.append(
                    WakeEvent(keyword="hey jarvis", confidence=score, at_sample=self._samples_seen)
                )
            elif score < self._threshold * 0.5:
                self._armed = True
        return events

    def reset(self) -> None:
        self._model.reset()
        self._buffer = np.zeros(0, dtype=np.float32)
        self._samples_seen = 0
        self._armed = True
