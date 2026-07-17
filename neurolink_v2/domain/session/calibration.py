"""CalibrationController — session-start resting baseline + Stage-0 gating.

Wraps the two ported components that together implement Neurolink's
session-start calibration:

* :class:`Stage0Guard` — impedance / IMU / environment readiness gate.
* :class:`BaselineRecorder` — the eyes-closed resting baseline state machine
  (``warmup`` → ``recording`` → ``complete``), whose durations come from the
  authoritative ``artifact_config`` constants (30 s warmup discard, 150 s
  total).  These are the ported v1 values, kept as the single source of truth
  rather than re-deriving a shorter window here.

The controller is deliberately UI/transport-agnostic: callers feed it EEG
frames via :meth:`feed` and read ``phase`` / ``progress`` / ``acquisition_ready``
to drive a calibration screen.
"""

from __future__ import annotations

import time

import numpy as np

from neurolink_v2.domain.signal.dsp.artifact_config import (
    BASELINE_DISCARD_SEC,
    BASELINE_TOTAL_SEC,
)
from neurolink_v2.domain.signal.dsp.asr import ArtifactSubspaceReconstructor
from neurolink_v2.domain.signal.dsp.baseline import BaselineRecorder
from neurolink_v2.domain.signal.stage0 import Stage0Guard


class _NullHub:
    def notify_baseline_complete(self) -> None:  # pragma: no cover - trivial
        return None


class CalibrationController:
    """Drives the session-start calibration (Stage-0 gate + resting baseline)."""

    warmup_sec: float = BASELINE_DISCARD_SEC
    total_sec: float = BASELINE_TOTAL_SEC

    def __init__(self, electrode_type: str = "dry") -> None:
        self.stage0 = Stage0Guard(electrode_type=electrode_type)
        self._baseline = BaselineRecorder(
            asr=ArtifactSubspaceReconstructor(), hub=_NullHub()
        )
        self._start_ts = time.monotonic()

    @property
    def phase(self) -> str:
        return self._baseline.phase

    @property
    def is_complete(self) -> bool:
        return self._baseline.is_complete

    @property
    def acquisition_ready(self) -> bool:
        return self.stage0.acquisition_ready

    @property
    def progress(self) -> float:
        """Fraction of the total baseline window elapsed, clamped to [0, 1]."""
        elapsed = time.monotonic() - self._start_ts
        return max(0.0, min(1.0, elapsed / self.total_sec))

    def feed(self, eeg_arr: np.ndarray) -> str:
        """Advance the baseline state machine with one clean EEG frame.

        Returns the current phase string after processing the frame.
        """
        self._baseline.process(eeg_arr)
        return self._baseline.phase

    def reset(self) -> None:
        self._baseline.reset()
        self._start_ts = time.monotonic()

    def status_dict(self) -> dict:
        return {
            "phase": self.phase,
            "progress": round(self.progress, 3),
            "is_complete": self.is_complete,
            "warmup_sec": self.warmup_sec,
            "total_sec": self.total_sec,
            "stage0": self.stage0.status_dict(),
        }
