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

from fastapi import WebSocket

from neurolink_v2.domain.device.manager import device_manager
from neurolink_v2.domain.signal.bandpower import compute_band_powers

log = logging.getLogger(__name__)

_EEG_POLL_HZ = 10        # frontend frame rate (10 fps = 25.6 EEG samples / frame)
_OPT_POLL_HZ = 5
_IMU_POLL_HZ = 5


class StreamBroadcaster:
    """Manages the set of active WebSocket subscribers."""

    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._running = False

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
        asyncio.create_task(self._eeg_pump())
        asyncio.create_task(self._optical_pump())
        asyncio.create_task(self._imu_pump())

    async def stop_pump(self) -> None:
        self._running = False

    # ------------------------------------------------------------------
    # Pump coroutines
    # ------------------------------------------------------------------

    async def _eeg_pump(self) -> None:
        interval = 1.0 / _EEG_POLL_HZ
        while self._running:
            await asyncio.sleep(interval)
            if not device_manager.is_streaming:
                continue
            snap = await device_manager.get_eeg_snapshot()
            if snap:
                # Attach live band powers to the EEG frame
                band_powers = {}
                for name, samples in snap["eeg"].items():
                    if samples:
                        band_powers[name] = compute_band_powers(samples)
                snap["type"] = "eeg"
                snap["band_powers"] = band_powers
                snap["battery"] = await device_manager.get_battery_level()
                await self.broadcast(snap)

    async def _optical_pump(self) -> None:
        interval = 1.0 / _OPT_POLL_HZ
        while self._running:
            await asyncio.sleep(interval)
            if not device_manager.is_streaming:
                continue
            snap = await device_manager.get_optical_snapshot()
            if snap:
                snap["type"] = "optical"
                await self.broadcast(snap)

    async def _imu_pump(self) -> None:
        interval = 1.0 / _IMU_POLL_HZ
        while self._running:
            await asyncio.sleep(interval)
            if not device_manager.is_streaming:
                continue
            snap = await device_manager.get_imu_snapshot()
            if snap:
                snap["type"] = "imu"
                await self.broadcast(snap)


broadcaster = StreamBroadcaster()
