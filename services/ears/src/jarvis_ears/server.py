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

import httpx

from .stt_sherpa import SherpaStreamingStt
from .tts_kokoro import KokoroTts
from .tts_openai import OpenAiTts
from .vad_silero import SileroVad
from .wake_openwakeword import OpenWakeWord

MODELS_DIR = Path(os.environ.get("JARVIS_EARS_MODELS", "/tmp/jarvis-ears-models"))
OFFLINE = os.environ.get("JARVIS_OFFLINE", "") in ("1", "true")
KERNEL_URL = os.environ.get("JARVIS_KERNEL_URL", "http://127.0.0.1:4150")
DEFAULT_VOICE = os.environ.get("JARVIS_VOICE", "bm_george")

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
    try:
        engines["stt"] = SherpaStreamingStt(MODELS_DIR / "stt")
    except Exception as e:  # noqa: BLE001
        engine_errors["stt"] = str(e)
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
        "sttLoaded": "stt" in engines,
        "kernelUrl": KERNEL_URL,
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


def _transcribe_pcm16(pcm16: np.ndarray) -> dict:
    """Run the full utterance through the streaming STT and return the transcript."""
    stt = engines.get("stt")
    if stt is None:
        return {"error": engine_errors.get("stt", "stt not loaded")}
    stt.reset()  # type: ignore[attr-defined]
    t0 = time.time()
    for i in range(0, len(pcm16), 1600):
        stt.push(pcm16[i : i + 1600])  # type: ignore[attr-defined]
    final = stt.finalize()  # type: ignore[attr-defined]
    return {
        "text": final.text,
        "sttMs": round((time.time() - t0) * 1000),
        "audioSeconds": round(len(pcm16) / 16000, 2),
    }


class TranscribeRequest(BaseModel):
    pcm16Base64: str  # mono float32 @16kHz


@app.post("/transcribe")
def transcribe(req: TranscribeRequest) -> dict:
    pcm = np.frombuffer(base64.b64decode(req.pcm16Base64), dtype=np.float32)
    return _transcribe_pcm16(pcm)


class VoiceTurnRequest(BaseModel):
    """A complete captured utterance @16kHz mono float32. On the Mac the audio
    comes from the echo-cancelled mic (VPIO); here it's supplied directly."""
    pcm16Base64: str
    sessionId: str | None = None
    voice: str = DEFAULT_VOICE
    ttsEngine: str = "kokoro"


@app.post("/voice-turn")
def voice_turn(req: VoiceTurnRequest) -> dict:
    """Full voice round-trip: audio -> STT -> kernel core loop -> TTS audio out.
    Every stage is real: real streaming STT, the real gated reasoning loop in the
    kernel (with its audit + memory), and real local TTS."""
    pcm = np.frombuffer(base64.b64decode(req.pcm16Base64), dtype=np.float32)
    heard = _transcribe_pcm16(pcm)
    if "error" in heard or not heard.get("text"):
        return {"stage": "stt", **heard}

    # Reason via the kernel's core loop (SSE token stream).
    body = {"text": heard["text"], "source": "voice", "privacyClass": "LOCAL_ONLY"}
    if req.sessionId:
        body["sessionId"] = req.sessionId
    answer = ""
    t0 = time.time()
    with httpx.stream("POST", f"{KERNEL_URL}/core/converse", json=body, timeout=120) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                try:
                    evt = __import__("json").loads(line[5:].strip())
                    if evt.get("type") == "token":
                        answer += evt["text"]
                except Exception:  # noqa: BLE001
                    pass
    reason_ms = round((time.time() - t0) * 1000)

    # Speak the answer.
    tts = engines.get(f"tts_{req.ttsEngine}")
    if tts is None:
        return {"stage": "tts", "heard": heard["text"], "answer": answer,
                "error": f"tts engine '{req.ttsEngine}' unavailable"}
    t1 = time.time()
    chunks = list(tts.synthesize(answer, req.voice))  # type: ignore[attr-defined]
    out = np.concatenate([c.pcm for c in chunks]) if chunks else np.zeros(0, dtype=np.float32)
    sr = chunks[0].sample_rate if chunks else 0
    return {
        "heard": heard["text"],
        "answer": answer,
        "sttMs": heard["sttMs"],
        "reasonMs": reason_ms,
        "ttsMs": round((time.time() - t1) * 1000),
        "sampleRate": sr,
        "answerAudioSeconds": round(len(out) / sr, 2) if sr else 0,
        "pcmBase64": base64.b64encode(out.astype(np.float32).tobytes()).decode(),
    }


@app.websocket("/listen")
async def listen(ws: WebSocket) -> None:
    """Continuous listening: emits wake, VAD, and live STT partial/final events.
    On the Mac the PCM comes from the echo-cancelled mic; the protocol is the same."""
    await ws.accept()
    wake = engines.get("wake")
    vad = engines.get("vad")
    stt = engines.get("stt")
    if wake is None or vad is None:
        await ws.send_json({"type": "error", "message": f"engines unavailable: {engine_errors}"})
        await ws.close()
        return
    wake.reset()  # type: ignore[attr-defined]
    vad.reset()  # type: ignore[attr-defined]
    if stt is not None:
        stt.reset()  # type: ignore[attr-defined]
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
            if stt is not None:
                for p in stt.push(pcm):  # type: ignore[attr-defined]
                    await ws.send_json(
                        {"type": "final" if p.is_final else "partial", "text": p.text, "atMs": round(p.at_ms)}
                    )
    except WebSocketDisconnect:
        pass
