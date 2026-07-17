"""jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).

GET  /health  — real engine states (loaded models, offline flag); nothing canned
POST /tts     — synthesize; engine selected by request/config, offline-gated
WS   /listen  — PCM in (16 kHz float32 frames), JSON events out:
                {type: wake|vad|partial|final, ...} with measured timings (R-VOICE-09)

STT engines are Mac-first (Kyutai MLX / whisper.cpp); until slice 1.3 completes
on the Mac, /listen serves wake + VAD events only and reports that honestly in
/health (no fake transcription is ever emitted — R-CORE-02).
"""

from __future__ import annotations

import base64
import os
import time
from pathlib import Path

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from .tts_kokoro import KokoroTts
from .tts_openai import OpenAiTts
from .vad_silero import SileroVad
from .wake_openwakeword import OpenWakeWord

MODELS_DIR = Path(os.environ.get("JARVIS_EARS_MODELS", "/tmp/jarvis-ears-models"))
OFFLINE = os.environ.get("JARVIS_OFFLINE", "") in ("1", "true")

app = FastAPI(title="jarvis-ears")
started_at = time.time()

engines: dict[str, object] = {}
engine_errors: dict[str, str] = {}


@app.on_event("startup")
def load_engines() -> None:
    try:
        engines["tts_kokoro"] = KokoroTts(
            MODELS_DIR / "kokoro" / "model.onnx", MODELS_DIR / "kokoro" / "voices"
        )
    except Exception as e:  # noqa: BLE001 — health reports the real failure
        engine_errors["tts_kokoro"] = str(e)
    try:
        engines["vad"] = SileroVad(MODELS_DIR / "silero_vad.onnx")
    except Exception as e:  # noqa: BLE001
        engine_errors["vad"] = str(e)
    try:
        engines["wake"] = OpenWakeWord(MODELS_DIR)
    except Exception as e:  # noqa: BLE001
        engine_errors["wake"] = str(e)
    openai_tts = OpenAiTts()
    if openai_tts.configured() and not OFFLINE:
        engines["tts_openai"] = openai_tts


@app.get("/health")
def health() -> dict:
    return {
        "service": "ears",
        "status": "ok" if not engine_errors else "degraded",
        "uptimeSeconds": round(time.time() - started_at),
        "offline": OFFLINE,
        "engines": {
            name: {"loaded": True, "kind": type(engine).__name__}
            for name, engine in engines.items()
        },
        "engineErrors": engine_errors,
        "stt": {"loaded": False, "note": "STT lands with the Mac part of slice 1.3 (Kyutai MLX / whisper.cpp)"},
    }


class TtsRequest(BaseModel):
    text: str
    voice: str = "bm_george"
    engine: str = "kokoro"
    speed: float = 1.0


@app.post("/tts")
def tts(req: TtsRequest) -> dict:
    key = f"tts_{req.engine}"
    engine = engines.get(key)
    if engine is None:
        available = [k.removeprefix("tts_") for k in engines if k.startswith("tts_")]
        reason = engine_errors.get(key, f"engine not loaded (available: {available})")
        if req.engine == "openai" and OFFLINE:
            reason = "offline mode: remote TTS refused"
        return {"error": reason}
    t0 = time.time()
    chunks = list(engine.synthesize(req.text, req.voice, req.speed))  # type: ignore[attr-defined]
    pcm = np.concatenate([c.pcm for c in chunks]) if chunks else np.zeros(0, dtype=np.float32)
    sample_rate = chunks[0].sample_rate if chunks else 0
    return {
        "engine": req.engine,
        "voice": req.voice,
        "sampleRate": sample_rate,
        "durationSeconds": round(len(pcm) / sample_rate, 2) if sample_rate else 0,
        "synthesisMs": round((time.time() - t0) * 1000),
        "pcmBase64": base64.b64encode(pcm.astype(np.float32).tobytes()).decode(),
    }


@app.websocket("/listen")
async def listen(ws: WebSocket) -> None:
    await ws.accept()
    wake = engines.get("wake")
    vad = engines.get("vad")
    if wake is None or vad is None:
        await ws.send_json({"type": "error", "message": f"engines unavailable: {engine_errors}"})
        await ws.close()
        return
    wake.reset()  # type: ignore[attr-defined]
    vad.reset()  # type: ignore[attr-defined]
    speech_active = False
    try:
        while True:
            data = await ws.receive_bytes()
            pcm = np.frombuffer(data, dtype=np.float32)
            for event in wake.push(pcm):  # type: ignore[attr-defined]
                await ws.send_json(
                    {"type": "wake", "keyword": event.keyword, "atSample": event.at_sample}
                )
            for frame in vad.push(pcm):  # type: ignore[attr-defined]
                if frame.is_speech != speech_active:
                    speech_active = frame.is_speech
                    await ws.send_json(
                        {
                            "type": "vad",
                            "speech": speech_active,
                            "probability": round(frame.probability, 3),
                            "atSample": frame.at_sample,
                        }
                    )
    except WebSocketDisconnect:
        pass
