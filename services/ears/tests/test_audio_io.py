"""AudioIO HAL tests — the in-container adapters are real and fully testable."""

from __future__ import annotations

import numpy as np

from jarvis_ears.audio_io import BufferAudioSink, BufferAudioSource, resample


def test_buffer_source_yields_all_frames_in_order():
    pcm = np.arange(1000, dtype=np.float32)
    src = BufferAudioSource(pcm, sample_rate=16000)
    got = np.concatenate(list(src.frames(256)))
    assert np.array_equal(got, pcm)


def test_buffer_source_stops_early_on_close():
    src = BufferAudioSource(np.ones(1000, dtype=np.float32))
    frames = src.frames(100)
    next(frames)
    src.close()
    remaining = list(frames)
    assert len(remaining) == 0  # closed source yields nothing further


def test_buffer_sink_accumulates_and_stop_truncates():
    sink = BufferAudioSink(sample_rate=24000)
    sink.play(np.ones(100, dtype=np.float32))
    sink.stop()
    sink.play(np.ones(100, dtype=np.float32))  # ignored after stop (barge-in)
    assert len(sink.played) == 100


def test_resample_changes_length_proportionally():
    pcm = np.ones(24000, dtype=np.float32)
    out = resample(pcm, 24000, 16000)
    assert abs(len(out) - 16000) <= 1
    assert resample(pcm, 16000, 16000) is not None
