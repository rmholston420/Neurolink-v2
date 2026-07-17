"""Tests for the session-start CalibrationController."""

from __future__ import annotations

import numpy as np

from neurolink_v2.domain.session.calibration import CalibrationController
from neurolink_v2.domain.signal.dsp.artifact_config import (
    BASELINE_DISCARD_SEC,
    BASELINE_TOTAL_SEC,
)


def _frame() -> np.ndarray:
    return np.random.default_rng(0).standard_normal((4, 64)).astype(np.float32)


def test_starts_in_warmup():
    ctl = CalibrationController()
    assert ctl.phase == "warmup"
    assert not ctl.is_complete
    assert ctl.progress == 0.0 or ctl.progress < 0.01


def test_uses_ported_baseline_constants():
    ctl = CalibrationController()
    assert ctl.warmup_sec == BASELINE_DISCARD_SEC
    assert ctl.total_sec == BASELINE_TOTAL_SEC


def test_phase_advances_when_warmup_elapsed():
    ctl = CalibrationController()
    # Fast-forward the internal clocks past the warmup discard window.
    ctl._start_ts -= BASELINE_DISCARD_SEC + 1.0
    ctl._baseline._start_ts -= BASELINE_DISCARD_SEC + 1.0
    assert ctl.feed(_frame()) == "recording"
    assert ctl.progress > 0.0


def test_completes_after_total_window():
    ctl = CalibrationController()
    ctl._baseline._start_ts -= BASELINE_TOTAL_SEC + 1.0
    ctl._start_ts -= BASELINE_TOTAL_SEC + 1.0
    ctl.feed(_frame())  # WARMUP -> RECORDING
    ctl.feed(_frame())  # RECORDING -> COMPLETE
    assert ctl.phase == "complete"
    assert ctl.is_complete
    assert ctl.progress == 1.0


def test_status_dict_keys():
    ctl = CalibrationController()
    status = ctl.status_dict()
    for key in ("phase", "progress", "is_complete", "warmup_sec", "total_sec", "stage0"):
        assert key in status


def test_reset_returns_to_warmup():
    ctl = CalibrationController()
    ctl._baseline._start_ts -= BASELINE_TOTAL_SEC + 1.0
    ctl.feed(_frame())
    ctl.reset()
    assert ctl.phase == "warmup"
