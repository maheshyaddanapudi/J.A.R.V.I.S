"""TTS engine: Kokoro-82M via ONNX (model Apache-2.0). Local offline baseline.

Uses the onnx-community export (input_ids/style/speed signature) with the
kokoro-onnx tokenizer (espeak-ng phonemization). Sentence-chunked synthesis
gives perceived streaming; token-level streaming engines (Kyutai) are separate
adapters trialed on the Mac (D-0004a).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import numpy as np
import onnxruntime as ort
from kokoro_onnx.tokenizer import Tokenizer

from .engines import TtsChunk

SAMPLE_RATE = 24000


class KokoroTts:
    engine_id = "kokoro"
    local = True

    def __init__(self, model_path: Path, voices_dir: Path, lang: str = "en-gb") -> None:
        self._sess = ort.InferenceSession(str(model_path))
        self._tokenizer = Tokenizer()
        self._lang = lang
        self._voices: dict[str, np.ndarray] = {}
        for f in sorted(Path(voices_dir).glob("*.bin")):
            self._voices[f.stem] = np.fromfile(f, dtype=np.float32).reshape(-1, 1, 256)

    def voices(self) -> list[str]:
        return list(self._voices)

    def synthesize(self, text: str, voice: str, speed: float = 1.0) -> Iterable[TtsChunk]:
        if voice not in self._voices:
            raise ValueError(f"unknown kokoro voice '{voice}' (have: {list(self._voices)})")
        table = self._voices[voice]
        for sentence in _split_sentences(text):
            phonemes = self._tokenizer.phonemize(sentence, lang=self._lang)
            ids = self._tokenizer.tokenize(phonemes)
            input_ids = np.asarray([ids], dtype=np.int64)
            row = min(max(input_ids.shape[1] - 2, 0), table.shape[0] - 1)
            waveform = self._sess.run(
                None,
                {
                    "input_ids": input_ids,
                    "style": table[row].astype(np.float32),
                    "speed": np.array([speed], dtype=np.float32),
                },
            )[0][0]
            yield TtsChunk(
                pcm=waveform.astype(np.float32),
                sample_rate=SAMPLE_RATE,
                engine=self.engine_id,
                voice=voice,
            )


_SENTENCE_RE = re.compile(r"(?<=[.!?;:])\s+")


def _split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in _SENTENCE_RE.split(text.strip())]
    return [p for p in parts if p]
