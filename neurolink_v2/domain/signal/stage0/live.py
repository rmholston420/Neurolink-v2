"""Process-wide live Stage-0 guard for the pre-flight readiness endpoint.

The DSP ``signal_service`` deliberately runs with ``stage0_guard=None`` so that
Stage-0 gating never silently drops live frames during warmup. The calibration
ceremony, however, needs a *readable* Stage-0 status (impedance / IMU /
environment) before it starts the resting baseline.

This module owns a single :class:`Stage0Guard` whose impedance sub-system is fed
each EEG tick from the real per-channel impedance estimates already computed by
``frame_metrics`` — so the readiness endpoint reflects actual signal quality,
never a mock. Environment checklist steps are acknowledged via the REST layer.
"""

from __future__ import annotations

import threading

from neurolink_v2.domain.signal.stage0 import Stage0Guard


class _LiveStage0:
    """Thread-safe holder for the process-wide live Stage-0 guard."""

    def __init__(self, electrode_type: str = "dry") -> None:
        self._lock = threading.Lock()
        self._guard = Stage0Guard(electrode_type=electrode_type)

    def update_impedance_kohm(self, readings: dict[str, float] | None) -> None:
        """Feed real per-channel impedance estimates (label -> kΩ)."""
        if not readings:
            return
        with self._lock:
            self._guard.impedance.update_from_kohm(readings)

    def acknowledge(self, step_id: str) -> bool:
        with self._lock:
            return self._guard.environment.acknowledge(step_id)

    def acknowledge_all(self) -> None:
        with self._lock:
            self._guard.environment.acknowledge_all()

    def reset(self) -> None:
        with self._lock:
            self._guard.environment.reset()

    def status_dict(self) -> dict:
        with self._lock:
            return self._guard.status_dict()


live_stage0 = _LiveStage0()
