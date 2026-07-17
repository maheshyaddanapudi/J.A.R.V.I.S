"""VAD engine: Silero VAD v6 ONNX (MIT), 16 kHz, 512-sample frames."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import onnxruntime as ort

from .engines import VadFrame


class SileroVad:
    sample_rate = 16000
    frame_samples = 512

    _CONTEXT = 64  # Silero v5/v6 expects 64 samples of left context before each frame

    def __init__(self, model_path: Path, threshold: float = 0.5) -> None:
        self._sess = ort.InferenceSession(str(model_path))
        self._threshold = threshold
        self._state = np.zeros((2, 1, 128), dtype=np.float32)
        self._context = np.zeros(self._CONTEXT, dtype=np.float32)
        self._buffer = np.zeros(0, dtype=np.float32)
        self._samples_seen = 0

    def push(self, pcm: np.ndarray) -> list[VadFrame]:
        self._buffer = np.concatenate([self._buffer, pcm.astype(np.float32)])
        frames: list[VadFrame] = []
        while len(self._buffer) >= self.frame_samples:
            frame = self._buffer[: self.frame_samples]
            self._buffer = self._buffer[self.frame_samples :]
            out, self._state = self._run(frame)
            self._samples_seen += self.frame_samples
            frames.append(
                VadFrame(
                    is_speech=bool(out >= self._threshold),
                    probability=float(out),
                    at_sample=self._samples_seen,
                )
            )
        return frames

    def _run(self, frame: np.ndarray) -> tuple[float, np.ndarray]:
        window = np.concatenate([self._context, frame])
        outputs = self._sess.run(
            None,
            {
                "input": window[np.newaxis, :],
                "state": self._state,
                "sr": np.array(self.sample_rate, dtype=np.int64),
            },
        )
        self._context = frame[-self._CONTEXT :]
        prob = float(outputs[0].item())
        state = outputs[1]
        return prob, state

    def reset(self) -> None:
        self._state = np.zeros((2, 1, 128), dtype=np.float32)
        self._context = np.zeros(self._CONTEXT, dtype=np.float32)
        self._buffer = np.zeros(0, dtype=np.float32)
        self._samples_seen = 0
