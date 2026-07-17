"""Tests for the signal-mode toggle: endpoint, persistence, and pipeline paths.

Covers the three modes (meditation / notch / raw):

* ``POST /api/stream/mode`` returns 200 on valid modes, 400 on invalid, and is
  idempotent.
* ``GET /api/device/status`` exposes ``signal_mode``.
* The DSP pipeline emits unfiltered frames in raw mode, notch-suppressed frames
  in notch mode, and runs the full gate in meditation mode.
* A pk2pk > 75 µV frame is rejected in meditation mode but emitted clean in
  raw / notch modes.
* The mode persists across frames until changed.
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient
from scipy import signal as sp_signal

from neurolink_v2.domain.signal.dsp.models import EEGSample
from neurolink_v2.domain.signal.dsp.pipeline import EEGPipeline, apply_notch
from neurolink_v2.domain.stream.mode import DEFAULT_SIGNAL_MODE, stream_mode
from neurolink_v2.main import create_app


@pytest.fixture(autouse=True)
def _reset_mode():
    stream_mode.reset()
    yield
    stream_mode.reset()


def _client() -> TestClient:
    return TestClient(create_app())


def _sample(arr: np.ndarray) -> EEGSample:
    return EEGSample(eeg_buffer=[ch.tolist() for ch in arr], source="athena")


def _pipeline() -> EEGPipeline:
    from unittest.mock import MagicMock

    return EEGPipeline(hub=MagicMock())


# --------------------------------------------------------------------------
# Endpoint + status
# --------------------------------------------------------------------------


def test_post_mode_accepts_valid_modes():
    client = _client()
    for mode in ("meditation", "notch", "raw"):
        resp = client.post("/api/stream/mode", json={"mode": mode})
        assert resp.status_code == 200
        assert resp.json() == {"mode": mode}


def test_post_mode_rejects_invalid_mode():
    client = _client()
    resp = client.post("/api/stream/mode", json={"mode": "bogus"})
    assert resp.status_code == 400
    assert "error" in resp.json()
    # State must not have changed on an invalid request.
    assert stream_mode.mode == DEFAULT_SIGNAL_MODE


def test_post_mode_is_idempotent():
    client = _client()
    first = client.post("/api/stream/mode", json={"mode": "raw"})
    second = client.post("/api/stream/mode", json={"mode": "raw"})
    assert first.status_code == second.status_code == 200
    assert second.json() == {"mode": "raw"}


def test_get_mode_returns_current():
    client = _client()
    client.post("/api/stream/mode", json={"mode": "notch"})
    resp = client.get("/api/stream/mode")
    assert resp.status_code == 200
    assert resp.json() == {"mode": "notch"}


def test_device_status_includes_signal_mode():
    client = _client()
    client.post("/api/stream/mode", json={"mode": "raw"})
    resp = client.get("/api/device/status")
    assert resp.status_code == 200
    assert resp.json()["signal_mode"] == "raw"


# --------------------------------------------------------------------------
# apply_notch
# --------------------------------------------------------------------------


def test_apply_notch_suppresses_mains():
    fs = 256.0
    t = np.arange(0, 4, 1.0 / fs, dtype=np.float32)
    # 10 Hz alpha + strong 60 Hz mains hum.
    clean = np.sin(2 * np.pi * 10 * t)
    hum = 5.0 * np.sin(2 * np.pi * 60 * t)
    arr = np.tile(clean + hum, (4, 1)).astype(np.float32)

    out = apply_notch(arr, mains_hz=60.0, fs=fs, q=30.0)

    def power_at(sig: np.ndarray, freq: float) -> float:
        freqs, psd = sp_signal.welch(sig, fs=fs, nperseg=256)
        idx = int(np.argmin(np.abs(freqs - freq)))
        return float(psd[idx])

    # 60 Hz power drops sharply; 10 Hz alpha is largely preserved.
    assert power_at(out[0], 60.0) < 0.1 * power_at(arr[0], 60.0)
    assert power_at(out[0], 10.0) > 0.5 * power_at(arr[0], 10.0)


# --------------------------------------------------------------------------
# Pipeline mode paths
# --------------------------------------------------------------------------


def test_raw_mode_emits_unfiltered_samples():
    rng = np.random.default_rng(0)
    arr = rng.standard_normal((4, 256)).astype(np.float32)
    result = _pipeline().process(_sample(arr), mode="raw")
    assert result is not None
    assert result.artifact_rejected is False
    # Raw mode passes the electrode signal straight through (last-window slice).
    emitted = np.array(result.eeg_samples, dtype=np.float32)
    expected = arr[:, -emitted.shape[1]:]
    assert np.allclose(emitted, expected, atol=1e-4)


def test_notch_mode_suppresses_60hz():
    fs = 256.0
    t = np.arange(0, 4, 1.0 / fs, dtype=np.float32)
    arr = np.tile(np.sin(2 * np.pi * 10 * t) + 5.0 * np.sin(2 * np.pi * 60 * t), (4, 1)).astype(np.float32)
    result = _pipeline().process(_sample(arr), mode="notch")
    assert result is not None
    assert result.artifact_rejected is False

    emitted = np.array(result.eeg_samples, dtype=np.float32)
    freqs, psd_out = sp_signal.welch(emitted[0], fs=fs, nperseg=min(256, emitted.shape[1]))
    freqs_in, psd_in = sp_signal.welch(arr[0], fs=fs, nperseg=256)
    idx_out = int(np.argmin(np.abs(freqs - 60.0)))
    idx_in = int(np.argmin(np.abs(freqs_in - 60.0)))
    assert psd_out[idx_out] < 0.2 * psd_in[idx_in]


def test_meditation_mode_runs_full_pipeline():
    rng = np.random.default_rng(1)
    arr = rng.standard_normal((4, 512)).astype(np.float32)
    result = _pipeline().process(_sample(arr), mode="meditation")
    assert result is not None
    # Full path computes normalised band powers that sum to ~1.
    total = sum(result.bands.model_dump().values())
    assert abs(total - 1.0) < 1e-4


def test_high_amplitude_rejected_in_meditation_but_clean_in_bypass():
    fs = 256.0
    t = np.arange(0, 2, 1.0 / fs, dtype=np.float32)
    # 200 µV pk2pk sine — well above the 75 µV rejection threshold.
    arr = np.tile(100.0 * np.sin(2 * np.pi * 10 * t), (4, 1)).astype(np.float32)

    med = _pipeline().process(_sample(arr), mode="meditation")
    assert med is not None
    assert med.artifact_rejected is True

    for mode in ("raw", "notch"):
        res = _pipeline().process(_sample(arr), mode=mode)
        assert res is not None, mode
        assert res.artifact_rejected is False, mode


def test_bypass_counts_every_frame_clean():
    rng = np.random.default_rng(2)
    arr = rng.standard_normal((4, 256)).astype(np.float32)
    pipe = _pipeline()
    for _ in range(3):
        pipe.process(_sample(arr), mode="raw")
    health = pipe.health
    assert health.frames_total == 3
    assert health.frames_clean == 3
    assert health.frames_rejected == 0


def test_mode_persists_across_frames():
    stream_mode.set_mode("notch")
    assert stream_mode.mode == "notch"
    # Simulate several frames elapsing with no further mode change.
    for _ in range(5):
        assert stream_mode.mode == "notch"
    stream_mode.set_mode("meditation")
    assert stream_mode.mode == "meditation"
