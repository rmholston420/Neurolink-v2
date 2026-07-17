"""SignalPipelineService — thin singleton wrapper around ``EEGPipeline``.

The broadcaster's EEG pump feeds each live snapshot into this service so the
full ported DSP stack (Stages 1–6, artifact gating, baseline, band powers)
runs alongside the legacy per-channel band-power path.  The service also owns
the live ``StreamHealth`` snapshot exposed via ``GET /api/stream/health``.

Design notes
------------
* ``EEGPipeline`` requires a ``hub`` for ``BaselineRecorder`` bell events.  In
  v2 there is no monolithic hub, so a ``_NullHub`` no-op stand-in is used; the
  baseline-complete signal is surfaced through ``PipelineResult.baseline_phase``
  instead of a pushed SSE sentinel.
* ``stage0_guard`` is left ``None`` here: Stage-0 impedance/IMU gating is
  handled by the dedicated calibration controller
  (:mod:`neurolink_v2.domain.session.calibration`); wiring it into the live
  pump would silently drop frames during warmup.
* Every public method is defensive — a DSP failure must never take down the
  broadcast pump, so callers wrap ``process_snapshot`` in try/except.
"""

from __future__ import annotations

import threading

import numpy as np

from neurolink_v2.domain.signal.dsp.models import EEGSample, StreamHealthPayload
from neurolink_v2.domain.signal.dsp.pipeline import EEGPipeline, PipelineResult


class _NullHub:
    """No-op hub: baseline completion is read from the pipeline phase."""

    def notify_baseline_complete(self) -> None:  # pragma: no cover - trivial
        return None


class SignalPipelineService:
    """Process-wide holder for a single ``EEGPipeline`` instance."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pipeline = EEGPipeline(hub=_NullHub())

    @property
    def pipeline(self) -> EEGPipeline:
        return self._pipeline

    def reset(self) -> None:
        with self._lock:
            self._pipeline.reset()

    def health_payload(self) -> StreamHealthPayload:
        """Return the current stream-health snapshot as a pydantic model."""
        h = self._pipeline.health.to_dict()
        return StreamHealthPayload(
            frames_total=h["frames_total"],
            frames_rejected=h["frames_rejected"],
            frames_clean=h["frames_clean"],
            packet_loss_pct=h["packet_loss_pct"],
            last_frame_ts=h["last_frame_ts"],
            avg_tick_ms=h["avg_tick_ms"],
        )

    def process_snapshot(self, snap: dict) -> PipelineResult | None:
        """Run the DSP pipeline on one broadcaster EEG snapshot.

        ``snap['eeg']`` is a ``{channel_key: [float, ...]}`` mapping as produced
        by ``device_manager.get_eeg_snapshot``.  Only the first four entries
        (TP9, AF7, AF8, TP10) are used to build the pipeline's ``eeg_buffer``.
        Returns ``None`` when the snapshot carries no usable EEG.
        """
        eeg_map = snap.get("eeg") or {}
        channels = [samples for samples in eeg_map.values() if samples]
        if not channels:
            return None

        sample = EEGSample(
            eeg_buffer=[list(map(float, ch)) for ch in channels[:4]],
            source="athena",
        )
        with self._lock:
            return self._pipeline.process(sample)


signal_service = SignalPipelineService()
