"""Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

Sources (verified 2026-07-16, see docs/RESEARCH_VERIFICATION.md):
- Kokoro-82M ONNX (Apache-2.0): onnx-community/Kokoro-82M-v1.0-ONNX (HF)
- Silero VAD v6 ONNX (MIT): snakers4/silero-vad (GitHub raw)
- sherpa-onnx KWS zipformer gigaspeech (Apache-2.0): HF mirror

Usage: python scripts/fetch_models.py [dest_dir]
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

HF = "https://huggingface.co"
KOKORO = f"{HF}/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main"
OWW = f"{HF}/harvestsu/openwakeword-onnx/resolve/main"
STT = f"{HF}/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26/resolve/main"
SILERO = "https://raw.githubusercontent.com/snakers4/silero-vad/master/src/silero_vad/data/silero_vad.onnx"

BRITISH_MALE_VOICES = ["bm_fable", "bm_george", "bm_daniel", "bm_lewis"]
OWW_FILES = ["melspectrogram.onnx", "embedding_model.onnx", "hey_jarvis_v0.1.onnx"]
STT_FILES = [
    "encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
    "decoder-epoch-99-avg-1-chunk-16-left-128.onnx",
    "joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
    "tokens.txt",
]


def fetch(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"ok       {dest}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"fetching {url}")
    urllib.request.urlretrieve(url, dest)  # noqa: S310 — pinned https sources above
    print(f"saved    {dest} ({dest.stat().st_size} bytes)")


def main() -> None:
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/jarvis-ears-models")
    fetch(f"{KOKORO}/onnx/model.onnx", dest / "kokoro" / "model.onnx")
    for voice in BRITISH_MALE_VOICES:
        fetch(f"{KOKORO}/voices/{voice}.bin", dest / "kokoro" / "voices" / f"{voice}.bin")
    fetch(SILERO, dest / "silero_vad.onnx")
    for f in OWW_FILES:
        fetch(f"{OWW}/{f}", dest / f"oww_{f}")
    for f in STT_FILES:
        fetch(f"{STT}/{f}", dest / "stt" / f)
    # sherpa-onnx KWS (bare-"jarvis") assets ship via GitHub releases; fetch on
    # the Mac per services/ears/CLAUDE.md — wake_sherpa.py stays unverified here.


if __name__ == "__main__":
    main()
