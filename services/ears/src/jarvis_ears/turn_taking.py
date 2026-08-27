"""Full-duplex turn-taking + barge-in state machine (R-VOICE-03).

This is the ENGINE-NEUTRAL control logic: given VAD frames while J.A.R.V.I.S. is
speaking, decide when the user has barged in and playback must stop. It is fully
testable in the container. The one Mac-only piece is the audio path underneath:
macOS Voice Processing I/O (VPIO) echo-cancels J.A.R.V.I.S.'s own voice out of
the mic so the VAD sees the USER, not the assistant. Without echo cancellation,
this machine still works on a headset (no acoustic feedback path).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .engines import VadFrame


class VoiceState(Enum):
    IDLE = "idle"
    LISTENING = "listening"       # capturing a user utterance
    THINKING = "thinking"         # request sent, awaiting/streaming response
    SPEAKING = "speaking"         # playing TTS; barge-in armed
    BARGED_IN = "barged_in"       # user interrupted; stop playback


@dataclass
class TurnEvent:
    kind: str  # 'user_speech_start' | 'user_speech_end' | 'barge_in' | 'state'
    state: VoiceState
    at_ms: float


class TurnTaker:
    """Drives the conversation's turn state from VAD frames.

    Barge-in fires when, during SPEAKING, the user produces sustained speech
    (>= barge_in_ms of continuous voiced frames). A short cough won't interrupt;
    a real utterance will, within the configured latency budget (<=300ms target,
    R-VOICE-03).
    """

    def __init__(self, sample_rate: int = 16000, barge_in_ms: float = 200.0) -> None:
        self.state = VoiceState.IDLE
        self._sample_rate = sample_rate
        self._barge_in_ms = barge_in_ms
        self._voiced_run_ms = 0.0
        self._silence_run_ms = 0.0
        self._frame_ms = 0.0

    def begin_listening(self, at_ms: float = 0.0) -> TurnEvent:
        self.state = VoiceState.LISTENING
        self._voiced_run_ms = 0.0
        self._silence_run_ms = 0.0
        return TurnEvent("state", self.state, at_ms)

    def begin_speaking(self, at_ms: float = 0.0) -> TurnEvent:
        self.state = VoiceState.SPEAKING
        self._voiced_run_ms = 0.0
        return TurnEvent("state", self.state, at_ms)

    def begin_thinking(self, at_ms: float = 0.0) -> TurnEvent:
        self.state = VoiceState.THINKING
        return TurnEvent("state", self.state, at_ms)

    def push(self, frame: VadFrame) -> list[TurnEvent]:
        """Feed one VAD frame; returns any turn transitions it triggered."""
        # frame span in ms (Silero frames are 512 samples @16k = 32ms)
        self._frame_ms = 512 / self._sample_rate * 1000
        events: list[TurnEvent] = []
        at = frame.at_sample / self._sample_rate * 1000

        if frame.is_speech:
            self._voiced_run_ms += self._frame_ms
            self._silence_run_ms = 0.0
        else:
            self._silence_run_ms += self._frame_ms
            self._voiced_run_ms = 0.0

        if self.state == VoiceState.SPEAKING:
            # barge-in: sustained user speech during playback
            if frame.is_speech and self._voiced_run_ms >= self._barge_in_ms:
                self.state = VoiceState.BARGED_IN
                events.append(TurnEvent("barge_in", self.state, at))

        elif self.state == VoiceState.LISTENING:
            if frame.is_speech and self._voiced_run_ms == self._frame_ms:
                events.append(TurnEvent("user_speech_start", self.state, at))
            # end-of-utterance: ~700ms trailing silence after some speech
            if not frame.is_speech and self._silence_run_ms >= 700.0:
                events.append(TurnEvent("user_speech_end", self.state, at))

        return events
