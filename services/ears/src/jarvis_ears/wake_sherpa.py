"""Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).

The keyword ("jarvis") is defined as text — no cloud, no training, no account
(RESEARCH_VERIFICATION §2). Model: kws-zipformer-gigaspeech (English phones).

STATUS: NOT YET VERIFIED — the KWS model assets are distributed via GitHub
releases, unreachable from the dev container's network. Verify on the Mac
(slice 1.3 acceptance) before enabling; until then the served wake engine is
OpenWakeWord (wake_openwakeword.py), which is fully verified.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import sherpa_onnx

from .engines import WakeEvent


class SherpaKeywordWake:
    sample_rate = 16000

    def __init__(
        self,
        model_dir: Path,
        keywords: str = "jarvis",
        threshold: float = 0.25,
        score: float = 2.0,
    ) -> None:
        d = Path(model_dir)
        # tokenize keyword text to model phones via the bundled bpe vocab
        self._spotter = sherpa_onnx.KeywordSpotter(
            tokens=str(d / "tokens.txt"),
            encoder=str(d / "encoder-epoch-12-avg-2-chunk-16-left-64.onnx"),
            decoder=str(d / "decoder-epoch-12-avg-2-chunk-16-left-64.onnx"),
            joiner=str(d / "joiner-epoch-12-avg-2-chunk-16-left-64.onnx"),
            num_threads=2,
            keywords_file=str(d / "keywords.txt"),
            keywords_threshold=threshold,
            keywords_score=score,
        )
        self._stream = self._spotter.create_stream()
        self._samples_seen = 0

    def push(self, pcm: np.ndarray) -> list[WakeEvent]:
        events: list[WakeEvent] = []
        self._stream.accept_waveform(self.sample_rate, pcm.astype(np.float32))
        self._samples_seen += len(pcm)
        while self._spotter.is_ready(self._stream):
            self._spotter.decode_stream(self._stream)
            result = self._spotter.get_result(self._stream)
            if result:
                events.append(
                    WakeEvent(keyword=result, confidence=1.0, at_sample=self._samples_seen)
                )
                # reset stream state after a detection so it can fire again
                self._spotter.reset_stream(self._stream)
        return events

    def reset(self) -> None:
        self._stream = self._spotter.create_stream()
        self._samples_seen = 0
