"""Tests for the SignalPipelineService wrapper and /api/stream/health."""

from __future__ import annotations

import numpy as np

from neurolink_v2.domain.signal.dsp.models import StreamHealthPayload
from neurolink_v2.domain.signal.dsp.pipeline import PipelineResult
from neurolink_v2.domain.signal.service import SignalPipelineService


def _fake_snapshot(n: int = 256) -> dict:
    t = np.linspace(0, 1, n)
    return {
        "eeg": {
            "0": (np.sin(2 * np.pi * 10 * t)).tolist(),
            "1": (np.sin(2 * np.pi * 6 * t)).tolist(),
            "2": (np.sin(2 * np.pi * 20 * t)).tolist(),
            "3": (np.sin(2 * np.pi * 2 * t)).tolist(),
        }
    }


def test_process_snapshot_returns_result():
    svc = SignalPipelineService()
    result = svc.process_snapshot(_fake_snapshot())
    assert isinstance(result, PipelineResult)
    assert svc.pipeline.health.frames_total == 1


def test_process_snapshot_empty_eeg_returns_none():
    svc = SignalPipelineService()
    assert svc.process_snapshot({"eeg": {}}) is None
    assert svc.process_snapshot({}) is None


def test_health_payload_shape():
    svc = SignalPipelineService()
    svc.process_snapshot(_fake_snapshot())
    payload = svc.health_payload()
    assert isinstance(payload, StreamHealthPayload)
    assert payload.frames_total == 1
    assert payload.frames_clean + payload.frames_rejected == payload.frames_total


def test_reset_zeroes_health():
    svc = SignalPipelineService()
    svc.process_snapshot(_fake_snapshot())
    svc.reset()
    assert svc.health_payload().frames_total == 0
