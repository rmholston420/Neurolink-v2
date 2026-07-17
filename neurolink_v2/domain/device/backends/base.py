"""AthenaBackend Protocol -- the hardware-abstraction seam for Muse Athena.

Every concrete data source (BrainFlow, LSL, a fake for tests) satisfies this
async contract.  The adapter layer (:mod:`neurolink_v2.domain.device.adapter`)
consumes any ``AthenaBackend`` without caring how bytes reach the wire.

Muse Athena only.  No legacy (non-Athena) code paths exist here by design.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# Athena sampling rates (Hz).  Source-of-truth fallbacks; the BrainFlow backend
# confirms these against the board descriptor at runtime.
# ---------------------------------------------------------------------------

ATHENA_EEG_FS: float = 256.0
ATHENA_OPT_FS: float = 64.0
ATHENA_IMU_FS: float = 52.0


@runtime_checkable
class AthenaBackend(Protocol):
    """Hardware-agnostic async contract for a Muse Athena data source.

    Frame shapes
    ------------
    EEG    : ``list[list[float]] | None`` -- ``[[ch0_s0, ch0_s1, ...], ...]``
    OPT    : ``list[list[float]] | None`` -- raw optical rows, one row per sample
    IMU    : ``dict[str, list[float]] | None`` -- ``{"accel": [...], "gyro": [...]}``
    STATUS : ``dict[str, float] | None`` -- ``{"battery": 0.0-1.0}``
    """

    @property
    def transport_metadata(self) -> dict[str, str]:
        """Static descriptor, e.g. ``{"transport": "brainflow", ...}``."""
        ...

    @property
    def is_connected(self) -> bool:
        """Whether the backend currently holds an open session."""
        ...

    async def connect(self) -> None:
        """Open the hardware connection / resolve streams."""
        ...

    async def disconnect(self) -> None:
        """Close all open connections / streams."""
        ...

    async def read_eeg_frame(self) -> list[list[float]] | None:
        """Return one frame of EEG samples (outer index = channel)."""
        ...

    async def read_optical_frame(self) -> list[list[float]] | None:
        """Return one frame of raw optical rows, or ``None`` this tick."""
        ...

    async def read_imu_frame(self) -> dict[str, list[float]] | None:
        """Return one frame of IMU data, or ``None`` this tick."""
        ...

    async def read_status_frame(self) -> dict[str, float] | None:
        """Return the latest device-status snapshot, or ``None`` this tick."""
        ...
