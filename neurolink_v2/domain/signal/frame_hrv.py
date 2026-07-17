"""Rolling HRV + breathing tracker for the live WS EEG frame.

The Tier-B meditation UI (HRVCoherenceTrainer, BreathingPanel, the gold breath
halo) needs a live IBI / HRV time-series and a breathing rate + phase on the
broadcast frame. BrainFlow delivers PPG on the *optical* (ANCILLARY) preset and
accelerometer on the *IMU* (AUXILIARY) preset — separate pump coroutines from
the EEG pump. This module owns the cross-pump rolling buffers so the EEG pump
can attach a fused ``hrv`` + ``breathing`` block to each EEG snapshot.

Everything degrades honestly: with no hardware (empty optical buffer) the
tracker returns an empty dict and the UI renders an "insufficient data" state —
no value is ever fabricated. HRV is computed via the ported ``dsp/ppg.py``
(neurokit2 R-peak detection); breathing via ``dsp/breathing.py``.
"""

from __future__ import annotations

import time
from collections import deque
from statistics import pstdev

import numpy as np

from neurolink_v2.domain.signal.dsp.breathing import compute_breathing
from neurolink_v2.domain.signal.dsp.ppg import compute_ppg

# 64 Hz PPG; hold ~24 s so neurokit2 always has its 15 s minimum window.
_PPG_FS = 64.0
_PPG_MAXLEN = int(_PPG_FS * 24)
# 52 Hz accel; hold ~20 s for the respiratory FFT.
_ACCEL_FS = 52.0
_ACCEL_MAXLEN = int(_ACCEL_FS * 20)
# Number of most-recent IBIs to surface on the wire (keeps the frame small).
_IBI_WINDOW = 60


def _sdnn(ibi_ms: list[float]) -> float:
    """Standard deviation of NN (IBI) intervals — the classic time-domain HRV."""
    if len(ibi_ms) < 2:
        return 0.0
    try:
        return float(pstdev(ibi_ms))
    except Exception:
        return 0.0


def breath_phase(rate_bpm: float | None, now: float | None = None) -> tuple[float, str]:
    """Continuous breath-pacer phase in [0, 1) and a 4-part label.

    A single smooth oscillator locked to ``rate_bpm`` (falling back to the 5.5
    bpm coherence cadence). The cycle is split into inhale / hold / exhale /
    hold quarters so the pacer UI and the gold halo share one clock.
    """
    bpm = rate_bpm if (rate_bpm and rate_bpm > 0) else 5.5
    period = 60.0 / bpm
    t = (now if now is not None else time.time()) % period
    phase = t / period
    if phase < 0.25:
        label = "inhale"
    elif phase < 0.5:
        label = "hold"
    elif phase < 0.75:
        label = "exhale"
    else:
        label = "hold"
    return round(phase, 4), label


class FrameHrvTracker:
    """Stateful, single-instance HRV/breathing accumulator."""

    def __init__(self) -> None:
        self._ppg: deque[float] = deque(maxlen=_PPG_MAXLEN)
        self._accel_z: deque[float] = deque(maxlen=_ACCEL_MAXLEN)

    def reset(self) -> None:
        self._ppg.clear()
        self._accel_z.clear()

    def push_optical(self, optical: dict[str, list[float]] | None) -> None:
        """Append the PPG optode channel from an optical snapshot.

        Athena's ANCILLARY preset exposes several optical channels; the first is
        used as the PPG proxy for cardiac peak detection (documented heuristic —
        the same channel neurokit2 processes downstream).
        """
        if not optical:
            return
        first = next(iter(optical.values()), None)
        if first:
            self._ppg.extend(float(v) for v in first)

    def push_imu(self, accel: dict[str, list[float]] | None) -> None:
        """Append accel-z samples from an IMU snapshot for the respiratory FFT."""
        if not accel:
            return
        z = accel.get("z")
        if z:
            self._accel_z.extend(float(v) for v in z)

    def snapshot(self) -> dict:
        """Return ``{"hrv": {...}, "breathing": {...}}`` or ``{}`` when idle.

        Omits ``hrv`` until peak detection yields IBIs, and omits ``breathing``
        until a rate can be estimated, so partial data still surfaces.
        """
        out: dict = {}

        ibi_ms: list[float] = []
        if len(self._ppg) >= int(_PPG_FS * 15):
            payload = compute_ppg(np.asarray(self._ppg, dtype=np.float64), fs=_PPG_FS)
            if payload.ibi_ms:
                ibi_ms = payload.ibi_ms
                out["hrv"] = {
                    "rmssd": round(payload.hrv_rmssd, 2),
                    "sdnn": round(_sdnn(ibi_ms), 2),
                    "hr_bpm": round(payload.hr_bpm, 1),
                    "sd1": round(payload.sd1, 2),
                    "sd2": round(payload.sd2, 2),
                    "ibi_ms": [round(v, 1) for v in ibi_ms[-_IBI_WINDOW:]],
                }

        accel_z = np.asarray(self._accel_z, dtype=np.float64) if self._accel_z else None
        breathing = compute_breathing(ibi_ms, accel_z, accel_fs=_ACCEL_FS)
        if breathing.rr_bpm is not None:
            phase, label = breath_phase(breathing.rr_bpm)
            out["breathing"] = {
                "rate_bpm": round(breathing.rr_bpm, 2),
                "rr_ppg": round(breathing.rr_ppg, 2) if breathing.rr_ppg is not None else None,
                "rr_accel": round(breathing.rr_accel, 2) if breathing.rr_accel is not None else None,
                "phase": phase,
                "phase_label": label,
            }

        return out


frame_hrv_tracker = FrameHrvTracker()
