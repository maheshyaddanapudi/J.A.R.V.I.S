"""Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0).

True frame-level streaming with partial hypotheses and endpoint detection —
runs on CPU (no GPU/Metal needed), so it works identically in the Linux dev
container and on the Mac. On the Mac, a Kyutai-MLX or WhisperKit adapter can be
swapped in behind this same SttEngine contract (D-0004a); this is the portable
baseline and the guaranteed-offline path.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import sherpa_onnx

from .engines import SttPartial


class SherpaStreamingStt:
    sample_rate = 16000

    # standard sherpa-onnx streaming zipformer en 2023-06-26 (chunk-16-left-128)
    ENCODER = "encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx"
    DECODER = "decoder-epoch-99-avg-1-chunk-16-left-128.onnx"
    JOINER = "joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx"

    def __init__(self, model_dir: Path) -> None:
        d = Path(model_dir)
        self._recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
            tokens=str(d / "tokens.txt"),
            encoder=str(d / self.ENCODER),
            decoder=str(d / self.DECODER),
            joiner=str(d / self.JOINER),
            num_threads=2,
            sample_rate=self.sample_rate,
            feature_dim=80,
            enable_endpoint_detection=True,
            rule1_min_trailing_silence=2.4,
            rule2_min_trailing_silence=1.2,
            rule3_min_utterance_length=300,
            decoding_method="greedy_search",
        )
        self._stream = self._recognizer.create_stream()
        self._last_text = ""
        self._ms = 0.0
        # committed segments from prior endpoints in the same utterance turn
        self._committed: list[str] = []

    def _full_text(self) -> str:
        current = self._recognizer.get_result(self._stream)
        return " ".join([*self._committed, current]).strip()

    def push(self, pcm: np.ndarray) -> list[SttPartial]:
        self._stream.accept_waveform(self.sample_rate, pcm.astype(np.float32))
        self._ms += len(pcm) / self.sample_rate * 1000
        partials: list[SttPartial] = []
        while self._recognizer.is_ready(self._stream):
            self._recognizer.decode_stream(self._stream)
        text = self._recognizer.get_result(self._stream)
        if text and text != self._last_text:
            self._last_text = text
            partials.append(SttPartial(text=self._full_text(), is_final=False, at_ms=self._ms))
        if self._recognizer.is_endpoint(self._stream):
            seg = self._recognizer.get_result(self._stream)
            if seg:
                self._committed.append(seg)
            partials.append(SttPartial(text=self._full_text(), is_final=True, at_ms=self._ms))
            self._recognizer.reset(self._stream)
            self._last_text = ""
        return partials

    def finalize(self) -> SttPartial:
        # flush trailing audio through the decoder
        tail = np.zeros(int(self.sample_rate * 0.5), dtype=np.float32)
        self._stream.accept_waveform(self.sample_rate, tail)
        self._stream.input_finished()
        while self._recognizer.is_ready(self._stream):
            self._recognizer.decode_stream(self._stream)
        seg = self._recognizer.get_result(self._stream)
        if seg:
            self._committed.append(seg)
        result = SttPartial(text=" ".join(self._committed).strip(), is_final=True, at_ms=self._ms)
        return result

    def reset(self) -> None:
        self._stream = self._recognizer.create_stream()
        self._last_text = ""
        self._ms = 0.0
        self._committed = []
