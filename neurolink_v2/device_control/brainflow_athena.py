from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    from brainflow.board_shim import BoardIds, BoardShim, BrainFlowInputParams, BrainFlowPresets
except Exception:
    BoardIds = BoardShim = BrainFlowInputParams = BrainFlowPresets = None


@dataclass(slots=True)
class AthenaConfig:
    mac_address: str = ""
    serial_number: str = ""
    timeout: int = 15
    other_info: str = "preset=p1041;low_latency=true"
    max_samples: int = 64


class AthenaSession:
    def __init__(self, config: AthenaConfig | None = None):
        self.config = config or AthenaConfig()
        self.board = None
        self.board_id = None
        self.eeg_channels: list[int] = []
        self.imu_preset = None
        self.anc_preset = None

    def connect(self) -> None:
        if BoardShim is None:
            raise RuntimeError('BrainFlow is not installed')
        params = BrainFlowInputParams()
        params.mac_address = self.config.mac_address
        params.serial_number = self.config.serial_number
        params.timeout = self.config.timeout
        params.other_info = self.config.other_info
        self.board_id = BoardIds.MUSE_S_ATHENA_BOARD
        self.board = BoardShim(self.board_id, params)
        self.board.prepare_session()
        self.board.start_stream()
        self.eeg_channels = list(BoardShim.get_eeg_channels(self.board_id, BrainFlowPresets.DEFAULT_PRESET))
        self.imu_preset = BrainFlowPresets.AUXILIARY_PRESET
        self.anc_preset = BrainFlowPresets.ANCILLARY_PRESET

    def disconnect(self) -> None:
        if self.board is not None:
            try:
                self.board.stop_stream()
            finally:
                self.board.release_session()
        self.board = None

    def read_frame(self) -> dict[str, Any]:
        if self.board is None:
            raise RuntimeError('No active Athena session')
        eeg = self.board.get_board_data(self.config.max_samples, preset=BrainFlowPresets.DEFAULT_PRESET)
        imu = self.board.get_board_data(self.config.max_samples, preset=self.imu_preset)
        anc = self.board.get_board_data(self.config.max_samples, preset=self.anc_preset)
        eeg_payload = eeg[self.eeg_channels].tolist() if getattr(eeg, 'shape', (0, 0))[1] else []
        return {
            'timestamp': time.time(),
            'eeg_channels': self.eeg_channels,
            'eeg': eeg_payload,
            'imu_shape': list(getattr(imu, 'shape', (0, 0))),
            'anc_shape': list(getattr(anc, 'shape', (0, 0))),
            'samples': int(getattr(eeg, 'shape', (0, 0))[1]),
        }
