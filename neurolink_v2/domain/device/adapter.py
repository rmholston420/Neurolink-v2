"""AthenaBlueAdapter -- wraps any AthenaBackend and assembles frames.

The adapter owns the ring buffers, drives all four frame readers each tick, and
produces an :class:`AthenaSample` snapshot.  It is transport-agnostic: give it a
BrainFlow, LSL, or fake backend and it behaves identically.

Muse Athena only.  Raw optical rows are kept first-class (never collapsed into a
PPG-only signal); fNIRS decoding is a downstream concern.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field

from .backends.base import (
    ATHENA_EEG_FS,
    ATHENA_IMU_FS,
    ATHENA_OPT_FS,
    AthenaBackend,
)

_RING_SECS = 4.0
_OPT_RING_SECS = 30.0
_IMU_RING_SECS = 10.0

_N_EEG = int(ATHENA_EEG_FS * _RING_SECS)
_N_OPT = int(ATHENA_OPT_FS * _OPT_RING_SECS)
_N_IMU = int(ATHENA_IMU_FS * _IMU_RING_SECS)

# Athena's frontal EEG montage.
_ATHENA_EEG_CH = 4


@dataclass
class AthenaSample:
    """One assembled snapshot across all Athena modalities."""

    timestamp: float = field(default_factory=time.time)
    source: str = "athena"
    channels: list[float] = field(default_factory=list)
    eeg_buffer: list[list[float]] = field(default_factory=list)
    optical_raw: list[list[float]] | None = None
    optical_sampling_rate_hz: float | None = None
    accel_buffer: list[list[float]] | None = None
    gyro_buffer: list[list[float]] | None = None
    battery: float | None = None
    modality_sampling_rates: dict[str, float] = field(default_factory=dict)
    transport_metadata: dict[str, str] = field(default_factory=dict)


class AthenaBlueAdapter:
    """HardwareAdapter-style wrapper around any :class:`AthenaBackend`."""

    def __init__(self, backend: AthenaBackend) -> None:
        self._backend = backend
        self._eeg_rings: list[deque[float]] = [deque(maxlen=_N_EEG) for _ in range(_ATHENA_EEG_CH)]
        self._optical_rows: list[deque[float]] = []  # grown on first optical frame
        self._imu_buf: dict[str, list[float]] = {}
        self._battery: float | None = None

    @property
    def is_connected(self) -> bool:
        return self._backend.is_connected

    @property
    def transport_metadata(self) -> dict[str, str]:
        return self._backend.transport_metadata

    @property
    def source_name(self) -> str:
        return self._backend.transport_metadata.get("transport", "athena")

    async def connect(self) -> None:
        await self._backend.connect()

    async def disconnect(self) -> None:
        await self._backend.disconnect()

    async def read_sample(self) -> AthenaSample | None:
        if not self._backend.is_connected:
            return None

        eeg_frame = await self._backend.read_eeg_frame()
        if eeg_frame is not None:
            for ch_idx, ch_samples in enumerate(eeg_frame[:_ATHENA_EEG_CH]):
                ring = self._eeg_rings[ch_idx]
                for val in ch_samples:
                    ring.append(float(val))

        opt_frame = await self._backend.read_optical_frame()
        if opt_frame:
            n_optodes = len(opt_frame[0])
            if not self._optical_rows:
                self._optical_rows = [deque(maxlen=_N_OPT) for _ in range(n_optodes)]
            for row in opt_frame:
                for optode_idx, val in enumerate(row[: len(self._optical_rows)]):
                    self._optical_rows[optode_idx].append(float(val))

        imu_frame = await self._backend.read_imu_frame()
        if imu_frame is not None:
            self._imu_buf = imu_frame

        status_frame = await self._backend.read_status_frame()
        if status_frame is not None:
            self._battery = float(status_frame.get("battery", self._battery or 0.0))

        return self._build_sample()

    def _build_sample(self) -> AthenaSample:
        channels = [ring[-1] if ring else 0.0 for ring in self._eeg_rings]
        eeg_buffer = [list(ring) for ring in self._eeg_rings]

        optical_raw: list[list[float]] | None = None
        optical_fs: float | None = None
        if self._optical_rows:
            optical_raw = [list(ring) for ring in self._optical_rows]
            optical_fs = ATHENA_OPT_FS

        accel_buffer = _chunk3(self._imu_buf.get("accel")) if self._imu_buf else None
        gyro_buffer = _chunk3(self._imu_buf.get("gyro")) if self._imu_buf else None

        return AthenaSample(
            timestamp=time.time(),
            source=self.source_name,
            channels=channels,
            eeg_buffer=eeg_buffer,
            optical_raw=optical_raw,
            optical_sampling_rate_hz=optical_fs,
            accel_buffer=accel_buffer,
            gyro_buffer=gyro_buffer,
            battery=self._battery,
            modality_sampling_rates={
                "eeg": ATHENA_EEG_FS,
                "optical": ATHENA_OPT_FS,
                "imu": ATHENA_IMU_FS,
            },
            transport_metadata=self._backend.transport_metadata,
        )


def _chunk3(flat: list[float] | None) -> list[list[float]] | None:
    if not flat:
        return None
    return [flat[i : i + 3] for i in range(0, len(flat), 3)]
