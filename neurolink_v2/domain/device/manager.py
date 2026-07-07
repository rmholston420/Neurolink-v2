"""DeviceManager: owns the BrainFlow BoardShim lifecycle.

Concurrency model
-----------------
BrainFlow's C++ layer is thread-safe for start/stop calls.  We wrap
blocking BLE operations in asyncio.to_thread() so the FastAPI event loop
stays responsive.
"""

import asyncio
import logging
from typing import Optional

from brainflow.board_shim import (
    BoardIds,
    BoardShim,
    BrainFlowInputParams,
    BrainFlowPresets,
)

from neurolink_v2.domain.config.settings import settings

log = logging.getLogger(__name__)

_BOARD_ID = BoardIds.MUSE_S_ATHENA_BOARD.value
_DEFAULT_CHANNEL_NAMES = ['TP9', 'AF7', 'AF8', 'TP10']


class DeviceManager:

    async def get_battery_level(self):
        """Best-effort battery extraction from BrainFlow ancillary/status data."""
        import logging

        log = logging.getLogger(__name__)

        try:
            if not self._board:
                log.warning("battery: no board")
                return None

            from brainflow.board_shim import BoardShim, BrainFlowPresets

            board_id = self._board.get_board_id()
            battery_channel = BoardShim.get_battery_channel(
                board_id,
                BrainFlowPresets.ANCILLARY_PRESET
            )
            log.warning("battery: board_id=%s battery_channel=%s", board_id, battery_channel)

            data = await asyncio.to_thread(
                self._board.get_current_board_data,
                32,
                BrainFlowPresets.ANCILLARY_PRESET,
            )

            if data is None or len(data) == 0:
                log.warning("battery: no ancillary data")
                return None

            if battery_channel < 0 or battery_channel >= len(data):
                log.warning("battery: channel index out of range; data shape=%s", len(data))
                return None

            values = data[battery_channel]
            if values is None or len(values) == 0:
                log.warning("battery: channel has no values")
                return None

            latest = float(values[-1])
            log.warning("battery: raw latest=%s", latest)

            if 0.0 <= latest <= 1.0:
                pct = round(latest * 100.0, 2)
                log.warning("battery: normalized 0..1 -> %s%%", pct)
                return pct
            if 0.0 <= latest <= 100.0:
                pct = round(latest, 2)
                log.warning("battery: normalized 0..100 -> %s%%", pct)
                return pct

            val = round(latest, 4)
            log.warning("battery: returning raw=%s", val)
            return val

        except Exception as e:
            log.exception("battery: error while reading level: %s", e)
            return None
    def __init__(self) -> None:
        self._board: Optional[BoardShim] = None
        self._lock = asyncio.Lock()
        self.is_streaming: bool = False
        self.channel_names: list[str] = list(_DEFAULT_CHANNEL_NAMES)

    @property
    def has_board(self) -> bool:
        return self._board is not None

    @property
    def preset(self) -> str:
        return settings.muse_preset

    async def connect(self) -> dict:
        async with self._lock:
            if self._board is not None and self.is_streaming:
                return {
                    'status': 'already_connected',
                    'board_id': _BOARD_ID,
                    'preset': settings.muse_preset,
                    'channel_names': self.channel_names,
                }
            await asyncio.to_thread(self._sync_connect)
            self.is_streaming = True
            return {
                'status': 'connected',
                'board_id': _BOARD_ID,
                'preset': settings.muse_preset,
                'channel_names': self.channel_names,
            }

    async def disconnect(self) -> dict:
        async with self._lock:
            if self._board is None:
                return {'status': 'not_connected'}
            await asyncio.to_thread(self._sync_disconnect)
            self.is_streaming = False
            return {'status': 'disconnected'}

    async def get_eeg_snapshot(self, num_samples: int = 256) -> dict:
        if not self.is_streaming or self._board is None:
            return {}
        data = await asyncio.to_thread(
            self._board.get_current_board_data,
            num_samples,
            BrainFlowPresets.DEFAULT_PRESET,
        )
        eeg_ch = BoardShim.get_eeg_channels(_BOARD_ID, BrainFlowPresets.DEFAULT_PRESET)
        ts_ch = BoardShim.get_timestamp_channel(_BOARD_ID, BrainFlowPresets.DEFAULT_PRESET)
        return {
            'timestamps': data[ts_ch].tolist(),
            'eeg': {str(ch): data[ch].tolist() for ch in eeg_ch},
            'channel_names': self.channel_names,
        }

    async def get_optical_snapshot(self, num_samples: int = 64) -> dict:
        if not self.is_streaming or self._board is None:
            return {}
        data = await asyncio.to_thread(
            self._board.get_current_board_data,
            num_samples,
            BrainFlowPresets.ANCILLARY_PRESET,
        )
        opt_ch = BoardShim.get_optical_channels(_BOARD_ID, BrainFlowPresets.ANCILLARY_PRESET)
        ts_ch = BoardShim.get_timestamp_channel(_BOARD_ID, BrainFlowPresets.ANCILLARY_PRESET)
        return {
            'timestamps': data[ts_ch].tolist(),
            'optical': {str(i): data[ch].tolist() for i, ch in enumerate(opt_ch)},
        }

    async def get_imu_snapshot(self, num_samples: int = 52) -> dict:
        if not self.is_streaming or self._board is None:
            return {}
        data = await asyncio.to_thread(
            self._board.get_current_board_data,
            num_samples,
            BrainFlowPresets.AUXILIARY_PRESET,
        )
        accel_ch = BoardShim.get_accel_channels(_BOARD_ID, BrainFlowPresets.AUXILIARY_PRESET)
        gyro_ch = BoardShim.get_gyro_channels(_BOARD_ID, BrainFlowPresets.AUXILIARY_PRESET)
        ts_ch = BoardShim.get_timestamp_channel(_BOARD_ID, BrainFlowPresets.AUXILIARY_PRESET)
        return {
            'timestamps': data[ts_ch].tolist(),
            'accel': {ax: data[ch].tolist() for ax, ch in zip(['x', 'y', 'z'], accel_ch)},
            'gyro': {ax: data[ch].tolist() for ax, ch in zip(['x', 'y', 'z'], gyro_ch)},
        }

    def _sync_connect(self) -> None:
        BoardShim.enable_board_logger()
        params = BrainFlowInputParams()
        if settings.muse_mac_address:
            params.mac_address = settings.muse_mac_address
        if settings.muse_serial_number:
            params.serial_number = settings.muse_serial_number
        params.other_info = settings.brainflow_other_info

        board = BoardShim(_BOARD_ID, params)
        board.prepare_session()
        board.start_stream()
        self._board = board
        try:
            names = BoardShim.get_eeg_names(_BOARD_ID, BrainFlowPresets.DEFAULT_PRESET)
            if names:
                if isinstance(names, str):
                    parsed = [n.strip() for n in names.split(',') if n.strip()]
                else:
                    parsed = [str(n) for n in names]
                if parsed:
                    self.channel_names = parsed
        except Exception:
            self.channel_names = list(_DEFAULT_CHANNEL_NAMES)
        log.info('Muse S Athena connected and streaming (preset=%s).', settings.muse_preset)

    def _sync_disconnect(self) -> None:
        if self._board is None:
            return
        try:
            self._board.stop_stream()
        except Exception:
            pass
        try:
            if self._board.is_prepared():
                self._board.release_session()
        except Exception:
            pass
        self._board = None
        log.info('Muse S Athena disconnected.')


device_manager = DeviceManager()
