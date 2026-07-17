"""Turn-taking / barge-in state-machine tests (engine-neutral, no models needed)."""

from __future__ import annotations

from jarvis_ears.engines import VadFrame
from jarvis_ears.turn_taking import TurnTaker, VoiceState


def frames(pattern: list[bool], sample_rate: int = 16000):
    """Turn a bool speech/silence pattern into 32ms Silero-sized VAD frames."""
    step = 512
    out = []
    for i, is_speech in enumerate(pattern):
        out.append(VadFrame(is_speech=is_speech, probability=1.0 if is_speech else 0.0,
                             at_sample=(i + 1) * step))
    return out


def test_barge_in_fires_on_sustained_speech_while_speaking():
    tt = TurnTaker(barge_in_ms=200)
    tt.begin_speaking()
    # ~200ms of continuous speech = 7 frames of 32ms
    events = []
    for f in frames([True] * 8):
        events.extend(tt.push(f))
    assert any(e.kind == "barge_in" for e in events)
    assert tt.state == VoiceState.BARGED_IN


def test_short_cough_does_not_barge_in():
    tt = TurnTaker(barge_in_ms=200)
    tt.begin_speaking()
    # 2 voiced frames (~64ms) then silence — below the barge-in threshold
    events = []
    for f in frames([True, True, False, False, False]):
        events.extend(tt.push(f))
    assert not any(e.kind == "barge_in" for e in events)
    assert tt.state == VoiceState.SPEAKING


def test_listening_detects_utterance_start_and_end():
    tt = TurnTaker()
    tt.begin_listening()
    pattern = [True] * 10 + [False] * 25  # speech then ~800ms silence
    events = []
    for f in frames(pattern):
        events.extend(tt.push(f))
    kinds = [e.kind for e in events]
    assert "user_speech_start" in kinds
    assert "user_speech_end" in kinds
    # start precedes end
    assert kinds.index("user_speech_start") < kinds.index("user_speech_end")


def test_no_barge_in_when_idle_or_listening():
    tt = TurnTaker(barge_in_ms=100)
    tt.begin_listening()
    events = []
    for f in frames([True] * 20):
        events.extend(tt.push(f))
    assert not any(e.kind == "barge_in" for e in events)
