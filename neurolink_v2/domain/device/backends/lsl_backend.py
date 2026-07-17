"""LSL-based fallback backend for Muse Athena (OpenMuse outlets).

Satisfies :class:`~neurolink_v2.domain.device.backends.base.AthenaBackend`.
``pylsl`` is imported lazily so it is only required when this backend is
selected via ``settings.transport == "lsl"``.

Muse Athena only.  The optical stream is treated as raw optical rows, never as
classic PPG.
"""

from __future__ import annotations

import asyncio
import logging

from .base import ATHENA_EEG_FS, ATHENA_IMU_FS, ATHENA_OPT_FS

log = logging.getLogger(__name__)


class AthenaLslBackend:
    """Consumes Muse Athena data via OpenMuse LSL outlets."""

    def __init__(self) -> None:
        self._eeg_inlet = None
        self._optical_inlet = None
        self._imu_inlet = None
        self._connected = False

    @property
    def transport_metadata(self) -> dict[str, str]:
        return {
            "transport": "lsl",
            "preset": "openmuse",
            "board_id": "MUSE_S_ATHENA_BOARD",
        }

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def modality_sampling_rates(self) -> dict[str, float]:
        return {"eeg": ATHENA_EEG_FS, "optical": ATHENA_OPT_FS, "imu": ATHENA_IMU_FS}

    async def connect(self) -> None:
        try:
            import pylsl
        except ImportError as exc:
            raise RuntimeError("pylsl is not installed. Run: pip install pylsl") from exc

        loop = asyncio.get_event_loop()
        eeg_streams = await loop.run_in_executor(
            None, lambda: pylsl.resolve_stream("type", "EEG", 1, 5.0)
        )
        if not eeg_streams:
            raise RuntimeError("No EEG LSL stream found for Athena. Is OpenMuse running?")
        self._eeg_inlet = _make_inlet(pylsl.StreamInlet, eeg_streams[0])

        for attr, stream_type in (("_optical_inlet", "PPG"), ("_imu_inlet", "Accelerometer")):
            try:
                streams = await loop.run_in_executor(
                    None, lambda t=stream_type: pylsl.resolve_stream("type", t, 1, 2.0)
                )
                if streams:
                    setattr(self, attr, _make_inlet(pylsl.StreamInlet, streams[0]))
            except Exception:
                log.info("athena_lsl_optional_stream_not_found type=%s", stream_type)

        self._connected = True
        log.info("athena_lsl_connected")

    async def disconnect(self) -> None:
        for inlet in (self._eeg_inlet, self._optical_inlet, self._imu_inlet):
            if inlet is not None:
                try:
                    inlet.close_stream()
                except Exception as exc:
                    log.debug("athena_inlet_close_error error=%s", exc)
        self._eeg_inlet = self._optical_inlet = self._imu_inlet = None
        self._connected = False
        log.info("athena_lsl_disconnected")

    async def _pull_chunk(self, inlet, max_samples: int):
        loop = asyncio.get_event_loop()
        try:
            chunk, _ = await loop.run_in_executor(
                None, lambda: inlet.pull_chunk(timeout=0.01, max_samples=max_samples)
            )
            return chunk
        except Exception as exc:
            log.warning("athena_lsl_read_error error=%s", exc)
            return None

    async def read_eeg_frame(self) -> list[list[float]] | None:
        if not self._connected or self._eeg_inlet is None:
            return None
        chunk = await self._pull_chunk(self._eeg_inlet, 64)
        if not chunk:
            return None
        n_ch = len(chunk[0])
        channels: list[list[float]] = [[] for _ in range(n_ch)]
        for sample in chunk:
            for ch, val in enumerate(sample):
                channels[ch].append(float(val))
        return channels

    async def read_optical_frame(self) -> list[list[float]] | None:
        if not self._connected or self._optical_inlet is None:
            return None
        chunk = await self._pull_chunk(self._optical_inlet, 32)
        if not chunk:
            return None
        return [[float(v) for v in sample] for sample in chunk]

    async def read_imu_frame(self) -> dict[str, list[float]] | None:
        if not self._connected or self._imu_inlet is None:
            return None
        chunk = await self._pull_chunk(self._imu_inlet, 32)
        if not chunk:
            return None
        accel: list[float] = []
        gyro: list[float] = []
        for sample in chunk:
            floats = [float(v) for v in sample]
            accel.extend(floats[0:3])
            gyro.extend(floats[3:6])
        return {"accel": accel, "gyro": gyro}

    async def read_status_frame(self) -> dict[str, float] | None:
        if not self._connected or self._eeg_inlet is None:
            return None
        try:
            loop = asyncio.get_event_loop()
            info = await loop.run_in_executor(None, lambda: self._eeg_inlet.info(timeout=0.05))
            battery = info.desc().child("acquisition").child_value("battery")
            if battery:
                return {"battery": float(battery) / 100.0}
        except Exception as exc:
            log.debug("athena_lsl_status_read_error error=%s", exc)
        return None


def _make_inlet(inlet_cls, stream_info):
    """Construct an LSL StreamInlet, tolerating zero-arg fakes in tests."""
    try:
        return inlet_cls(stream_info)
    except TypeError:
        return inlet_cls()
