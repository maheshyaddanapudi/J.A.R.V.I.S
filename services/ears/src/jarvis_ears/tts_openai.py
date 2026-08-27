"""Optional cloud TTS adapter: OpenAI speech API (D-0004a).

REMOTE engine: local=False — the service refuses it in offline mode and it is
only constructed when the user configured a key env var (R-LOC-02). The key is
read at call time from the environment, never stored or logged (R-MEM-06).
Style instructions give the expressive delivery Kokoro lacks; voice 'fable' is
the British-accented option in OpenAI's lineup.
"""

from __future__ import annotations

import io
import os
from typing import Iterable

import httpx
import numpy as np
import soundfile as sf

from .engines import TtsChunk

_VOICES = ["fable", "onyx", "echo", "alloy", "ash", "ballad", "coral", "nova", "sage", "shimmer", "verse"]


class OpenAiTts:
    engine_id = "openai"
    local = False

    def __init__(
        self,
        api_key_env: str = "OPENAI_API_KEY",
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini-tts",
        instructions: str = "Speak as a composed, dry-witted British butler: measured pace, understated warmth, precise diction.",
    ) -> None:
        self._api_key_env = api_key_env
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._instructions = instructions

    def configured(self) -> bool:
        return bool(os.environ.get(self._api_key_env))

    def voices(self) -> list[str]:
        return list(_VOICES)

    def synthesize(self, text: str, voice: str, speed: float = 1.0) -> Iterable[TtsChunk]:
        key = os.environ.get(self._api_key_env)
        if not key:
            raise RuntimeError(f"openai tts unconfigured: no key in {self._api_key_env}")
        response = httpx.post(
            f"{self._base_url}/audio/speech",
            headers={"authorization": f"Bearer {key}"},
            json={
                "model": self._model,
                "voice": voice,
                "input": text,
                "instructions": self._instructions,
                "response_format": "wav",
                "speed": speed,
            },
            timeout=60,
        )
        response.raise_for_status()
        pcm, sample_rate = sf.read(io.BytesIO(response.content), dtype="float32")
        if pcm.ndim > 1:
            pcm = pcm.mean(axis=1)
        yield TtsChunk(pcm=pcm, sample_rate=sample_rate, engine=self.engine_id, voice=voice)
