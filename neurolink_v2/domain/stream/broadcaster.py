"""WebSocket broadcaster: polls BrainFlow at *poll_hz* and fans out JSON
packets to all connected WebSocket clients.

Message schema (JSON)
---------------------
{
  "type": "eeg" | "optical" | "imu",
  "ts": [float, ...],           # Unix timestamps
  "data": { channel_key: [float, ...] },
  "channel_names": [str, ...]   # for EEG only
}
"""

import asyncio
import json
import logging
from typing import Set

from brainflow.exit_codes import BrainFlowError

from fastapi import WebSocket

from neurolink_v2.domain.device.manager import device_manager
from neurolink_v2.domain.signal.bandpower import compute_band_powers, compute_band_powers_debug
from neurolink_v2.domain.signal.frame_hrv import frame_hrv_tracker
from neurolink_v2.domain.signal.frame_metrics import (
    compute_frame_metrics,
    summarize_artifacts,
    summarize_bad_channels,
)
from neurolink_v2.domain.signal.quality import classify_bandpower_quality
from neurolink_v2.domain.signal.service import signal_service
from neurolink_v2.domain.signal.stage0.live import live_stage0
from neurolink_v2.domain.stream import recorder

log = logging.getLogger(__name__)

_EEG_POLL_HZ = 10        # frontend frame rate (10 fps = 25.6 EEG samples / frame)
_OPT_POLL_HZ = 5
_IMU_POLL_HZ = 5


class StreamBroadcaster:
    """Manages the set of active WebSocket subscribers."""

    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._running = False
        self._tasks: set[asyncio.Task] = set()

    async def subscribe(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)
        log.info("WebSocket client connected. Total: %d", len(self._clients))
        try:
            while True:
                # Keep connection alive; data is pushed from broadcast tasks.
                await asyncio.sleep(1)
                try:
                    await ws.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break
        finally:
            self._clients.discard(ws)
            log.info("WebSocket client disconnected. Total: %d", len(self._clients))

    async def broadcast(self, message: dict) -> None:
        dead: Set[WebSocket] = set()
        payload = json.dumps(message)
        for ws in self._clients:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        self._clients -= dead

    async def start_pump(self) -> None:
        """Launch background tasks that poll BrainFlow and broadcast."""
        if self._running:
            return
        self._running = True
        self._tasks = {
            asyncio.create_task(self._eeg_pump(), name="eeg-pump"),
            asyncio.create_task(self._optical_pump(), name="optical-pump"),
            asyncio.create_task(self._imu_pump(), name="imu-pump"),
        }

    async def stop_pump(self) -> None:
        self._running = False
        tasks = list(self._tasks)
        self._tasks.clear()
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    # ------------------------------------------------------------------
    # Pump coroutines
    # ------------------------------------------------------------------

    async def _eeg_pump(self) -> None:
        interval = 1.0 / _EEG_POLL_HZ
        try:
            while self._running:
                await asyncio.sleep(interval)
                if not self._running or not device_manager.is_streaming:
                    continue
                try:
                    snap = await device_manager.get_eeg_snapshot()
                except BrainFlowError as error:
                    if "BOARD_NOT_CREATED_ERROR" in str(error):
                        log.info("EEG pump stopping after board teardown")
                        break
                    log.exception("EEG pump BrainFlow error")
                    break
                if snap:
                    band_powers = {}
                    band_debug = {}
                    band_quality = {}
                    for name, samples in snap["eeg"].items():
                        if samples:
                            band_powers[name] = compute_band_powers(samples)
                            debug = compute_band_powers_debug(samples)
                            band_debug[name] = debug
                            band_quality[name] = classify_bandpower_quality(debug)
                    snap["type"] = "eeg"
                    snap["band_powers"] = band_powers
                    snap["band_debug"] = band_debug
                    snap["band_quality"] = band_quality
                    # Run the ported DSP pipeline alongside the legacy path.
                    # Additive only: a DSP failure must never kill the pump.
                    result = None
                    try:
                        result = signal_service.process_snapshot(snap)
                        if result is not None:
                            snap["pipeline"] = {
                                "bands": result.bands.model_dump(),
                                "bad_channels": result.bad_channels,
                                "artifact_rejected": result.artifact_rejected,
                                "artifact_reasons": result.artifact_reasons,
                                "baseline_phase": result.baseline_phase,
                                "faa": result.faa,
                                "fmt": result.fmt,
                            }
                            # Structured, UI-facing sensor-detail fields (Tier C):
                            # per-artifact-class coaching + per-channel bad state.
                            snap["artifacts"] = summarize_artifacts(
                                result.artifact_annotations
                            )
                            snap["bad_channels"] = summarize_bad_channels(
                                signal_service.bad_channel_stats(),
                                bool(result.bad_channels),
                            )
                        snap["stream_health"] = signal_service.health_payload().model_dump()
                    except Exception:
                        log.debug("signal pipeline tick failed", exc_info=True)
                    # Per-frame derived contact/impedance/focus/fatigue metrics.
                    # Additive only: never let a metrics failure kill the pump.
                    try:
                        bands = result.bands.model_dump() if result is not None else {}
                        snap.update(
                            compute_frame_metrics(
                                snap.get("eeg"),
                                snap.get("channel_names"),
                                bands,
                            )
                        )
                        # Feed the live Stage-0 guard with real impedance
                        # estimates so the readiness endpoint reflects actual
                        # contact quality (never mocked).
                        live_stage0.update_impedance_kohm(snap.get("impedance"))
                    except Exception:
                        log.debug("frame metrics tick failed", exc_info=True)
                    # Fused HRV + breathing from the cross-pump rolling buffers.
                    # Additive only: a tracker failure must never kill the pump,
                    # and empty sub-maps are simply absent (UI shows "no data").
                    try:
                        snap.update(frame_hrv_tracker.snapshot())
                    except Exception:
                        log.debug("hrv/breathing tick failed", exc_info=True)
                    try:
                        snap["battery"] = await device_manager.get_battery_level()
                    except BrainFlowError as error:
                        if "BOARD_NOT_CREATED_ERROR" in str(error):
                            snap["battery"] = None
                        else:
                            raise
                    recorder.record_packet("eeg", snap)
                    await self.broadcast(snap)
        except asyncio.CancelledError:
            log.debug("EEG pump cancelled")
            raise

    async def _optical_pump(self) -> None:
        interval = 1.0 / _OPT_POLL_HZ
        try:
            while self._running:
                await asyncio.sleep(interval)
                if not self._running or not device_manager.is_streaming:
                    continue
                try:
                    snap = await device_manager.get_optical_snapshot()
                except BrainFlowError as error:
                    if "BOARD_NOT_CREATED_ERROR" in str(error):
                        log.info("Optical pump stopping after board teardown")
                        break
                    log.exception("Optical pump BrainFlow error")
                    break
                if snap:
                    snap["type"] = "optical"
                    try:
                        frame_hrv_tracker.push_optical(snap.get("optical"))
                    except Exception:
                        log.debug("hrv optical push failed", exc_info=True)
                    recorder.record_packet("optical", snap)
                    await self.broadcast(snap)
        except asyncio.CancelledError:
            log.debug("Optical pump cancelled")
            raise

    async def _imu_pump(self) -> None:
        interval = 1.0 / _IMU_POLL_HZ
        try:
            while self._running:
                await asyncio.sleep(interval)
                if not self._running or not device_manager.is_streaming:
                    continue
                try:
                    snap = await device_manager.get_imu_snapshot()
                except BrainFlowError as error:
                    if "BOARD_NOT_CREATED_ERROR" in str(error):
                        log.info("IMU pump stopping after board teardown")
                        break
                    log.exception("IMU pump BrainFlow error")
                    break
                if snap:
                    snap["type"] = "imu"
                    try:
                        frame_hrv_tracker.push_imu(snap.get("accel"))
                    except Exception:
                        log.debug("hrv imu push failed", exc_info=True)
                    recorder.record_packet("imu", snap)
                    await self.broadcast(snap)
        except asyncio.CancelledError:
            log.debug("IMU pump cancelled")
            raise


broadcaster = StreamBroadcaster()
