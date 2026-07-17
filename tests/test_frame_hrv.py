"""Unit tests for the rolling HRV + breathing frame tracker."""

from __future__ import annotations

import numpy as np

from neurolink_v2.domain.signal.frame_hrv import (
    FrameHrvTracker,
    _sdnn,
    breath_phase,
)


def test_sdnn_basic():
    assert _sdnn([]) == 0.0
    assert _sdnn([800.0]) == 0.0
    # Known population std of [800, 820] about mean 810 is 10.
    assert abs(_sdnn([800.0, 820.0]) - 10.0) < 1e-6


def test_breath_phase_quarters():
    # rate 6 bpm -> 10 s period; probe each quarter deterministically.
    assert breath_phase(6.0, now=0.0) == (0.0, "inhale")
    assert breath_phase(6.0, now=3.0)[1] == "hold"
    assert breath_phase(6.0, now=6.0)[1] == "exhale"
    assert breath_phase(6.0, now=9.0)[1] == "hold"
    # None / zero rate falls back to the 5.5 bpm coherence cadence.
    p, label = breath_phase(None, now=0.0)
    assert p == 0.0 and label == "inhale"


def test_empty_tracker_returns_empty():
    t = FrameHrvTracker()
    assert t.snapshot() == {}
    t.push_optical(None)
    t.push_imu(None)
    assert t.snapshot() == {}


def test_breathing_surfaces_from_oscillatory_accel():
    """A clean ~0.2 Hz (12 bpm) accel-z sine yields a breathing block even
    without any PPG/HRV — partial data must still surface."""
    t = FrameHrvTracker()
    fs = 52.0
    n = int(fs * 20)
    tt = np.arange(n) / fs
    z = np.sin(2 * np.pi * 0.2 * tt).tolist()
    t.push_imu({"z": z})
    snap = t.snapshot()
    assert "hrv" not in snap  # no PPG pushed
    assert "breathing" in snap
    assert snap["breathing"]["rate_bpm"] is not None
    assert 6.0 <= snap["breathing"]["rate_bpm"] <= 33.0
    assert 0.0 <= snap["breathing"]["phase"] < 1.0
