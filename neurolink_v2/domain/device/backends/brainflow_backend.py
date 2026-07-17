"""BrainFlow-based concrete backend for Muse Athena.

Satisfies :class:`~neurolink_v2.domain.device.backends.base.AthenaBackend`.

BrainFlow >= 5.22.0 exposes ``BoardIds.MUSE_S_ATHENA_BOARD`` which activates the
full Athena preset (p1041: EEG + 5-optode fNIRS + IMU + battery).  The optical
rows are the frontal fNIRS array (850 / 730 / 660 nm) -- they are preserved raw
and never downsampled into a PPG-only pipeline.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .base import ATHENA_EEG_FS, ATHENA_IMU_FS, ATHENA_OPT_FS

log = logging.getLogger(__name__)


class AthenaBrainFlowBackend:
    """Muse Athena driver using the BrainFlow SDK."""

    def __init__(
        self,
        mac_address: str = "",
        serial_number: str = "",
        other_info: str = "preset=p1041;low_latency=true",
        timeout: int = 15,
    ) -> None:
        self._mac_address = mac_address
        self._serial_number = serial_number
        self._other_info = other_info
        self._timeout = timeout
        self._board: Any = None
        self._board_id: Any = None
        # Sampling rates confirmed from the board descriptor at connect() time,
        # falling back to the documented Athena constants.
        self._fs: dict[str, float] = {
            "eeg": ATHENA_EEG_FS,
            "optical": ATHENA_OPT_FS,
            "imu": ATHENA_IMU_FS,
        }

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    @property
    def transport_metadata(self) -> dict[str, str]:
        return {
            "transport": "brainflow",
            "preset": "p1041",
            "board_id": "MUSE_S_ATHENA_BOARD",
        }

    @property
    def is_connected(self) -> bool:
        return self._board is not None

    @property
    def modality_sampling_rates(self) -> dict[str, float]:
        return dict(self._fs)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def connect(self) -> None:
        try:
            from brainflow.board_shim import (
                BoardIds,
                BoardShim,
                BrainFlowInputParams,
                BrainFlowPresets,
            )
        except ImportError as exc:
            raise RuntimeError("brainflow is not installed. Run: pip install brainflow") from exc

        params = BrainFlowInputParams()
        params.mac_address = self._mac_address
        params.serial_number = self._serial_number
        params.other_info = self._other_info
        params.timeout = self._timeout

        self._board_id = BoardIds.MUSE_S_ATHENA_BOARD
        board = BoardShim(self._board_id, params)
        BoardShim.enable_board_logger()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, board.prepare_session)
        await loop.run_in_executor(None, board.start_stream)
        self._board = board

        self._refresh_sampling_rates(BoardShim, BrainFlowPresets)
        log.info("brainflow_connected board=MUSE_S_ATHENA_BOARD mac=%s", self._mac_address or "<auto>")

    def _refresh_sampling_rates(self, BoardShim: Any, BrainFlowPresets: Any) -> None:
        """Confirm sampling rates against the live board descriptor."""
        presets = {
            "eeg": BrainFlowPresets.DEFAULT_PRESET,
            "optical": BrainFlowPresets.ANCILLARY_PRESET,
            "imu": BrainFlowPresets.AUXILIARY_PRESET,
        }
        for modality, preset in presets.items():
            try:
                rate = float(BoardShim.get_sampling_rate(self._board_id, preset))
                if rate > 0:
                    self._fs[modality] = rate
            except Exception:
                log.debug("sampling_rate_lookup_failed modality=%s (using fallback)", modality)

    async def disconnect(self) -> None:
        if self._board is None:
            return
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, self._board.stop_stream)
        except Exception:
            log.exception("brainflow_stop_stream_failed")
        try:
            await loop.run_in_executor(None, self._board.release_session)
        except Exception:
            log.exception("brainflow_release_session_failed")
        finally:
            self._board = None
            log.info("brainflow_disconnected")

    # ------------------------------------------------------------------
    # Data readers
    # ------------------------------------------------------------------

    async def read_eeg_frame(self) -> list[list[float]] | None:
        if self._board is None:
            return None
        try:
            from brainflow.board_shim import BoardShim, BrainFlowPresets

            n = int(self._fs["eeg"])
            data = self._board.get_current_board_data(n, BrainFlowPresets.DEFAULT_PRESET)
            eeg_ch = BoardShim.get_eeg_channels(self._board_id, BrainFlowPresets.DEFAULT_PRESET)
            return [data[ch].tolist() for ch in eeg_ch]
        except Exception:
            log.exception("brainflow_read_eeg_failed")
            return None

    async def read_optical_frame(self) -> list[list[float]] | None:
        if self._board is None:
            return None
        try:
            from brainflow.board_shim import BoardShim, BrainFlowPresets

            n = int(self._fs["optical"])
            data = self._board.get_current_board_data(n, BrainFlowPresets.ANCILLARY_PRESET)
            try:
                opt_ch = BoardShim.get_optical_channels(self._board_id, BrainFlowPresets.ANCILLARY_PRESET)
            except Exception:
                return None
            if not len(opt_ch):
                return None
            return [data[ch].tolist() for ch in opt_ch]
        except Exception:
            log.exception("brainflow_read_optical_failed")
            return None

    async def read_imu_frame(self) -> dict[str, list[float]] | None:
        if self._board is None:
            return None
        try:
            from brainflow.board_shim import BoardShim, BrainFlowPresets

            n = int(self._fs["imu"])
            data = self._board.get_current_board_data(n, BrainFlowPresets.AUXILIARY_PRESET)
            try:
                acc = BoardShim.get_accel_channels(self._board_id, BrainFlowPresets.AUXILIARY_PRESET)
                gyro = BoardShim.get_gyro_channels(self._board_id, BrainFlowPresets.AUXILIARY_PRESET)
            except Exception:
                return None
            accel: list[float] = []
            for ch in acc:
                accel.extend(data[ch].tolist())
            gyros: list[float] = []
            for ch in gyro:
                gyros.extend(data[ch].tolist())
            return {"accel": accel, "gyro": gyros}
        except Exception:
            log.exception("brainflow_read_imu_failed")
            return None

    async def read_status_frame(self) -> dict[str, float] | None:
        if self._board is None:
            return None
        try:
            from brainflow.board_shim import BoardShim, BrainFlowPresets

            data = self._board.get_current_board_data(1, BrainFlowPresets.ANCILLARY_PRESET)
            try:
                bat_ch = BoardShim.get_battery_channel(self._board_id, BrainFlowPresets.ANCILLARY_PRESET)
            except Exception:
                return None
            values = data[bat_ch]
            return {"battery": float(values[-1]) if len(values) else 0.0}
        except Exception:
            log.exception("brainflow_read_status_failed")
            return None
