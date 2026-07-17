"""Parametric contract tests for the Athena transport abstraction.

A ``FakeAthenaBackend`` stands in for BrainFlow/LSL so the adapter and frame
assembly are exercised with no hardware.  The BrainFlow and LSL backends are
also checked for Protocol conformance and correct transport metadata.
"""

import pytest

from neurolink_v2.domain.device.adapter import AthenaBlueAdapter, AthenaSample
from neurolink_v2.domain.device.backends.base import (
    ATHENA_EEG_FS,
    ATHENA_IMU_FS,
    ATHENA_OPT_FS,
    AthenaBackend,
)
from neurolink_v2.domain.device.backends.brainflow_backend import AthenaBrainFlowBackend
from neurolink_v2.domain.device.backends.lsl_backend import AthenaLslBackend


class FakeAthenaBackend:
    """Minimal AthenaBackend that returns deterministic frames."""

    def __init__(self) -> None:
        self._connected = False

    @property
    def transport_metadata(self) -> dict[str, str]:
        return {"transport": "fake", "preset": "p1041", "board_id": "MUSE_S_ATHENA_BOARD"}

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def read_eeg_frame(self):
        return [[float(ch)] * 8 for ch in range(4)]

    async def read_optical_frame(self):
        # 5-optode frontal fNIRS array, 4 samples per tick.
        return [[float(optode) for optode in range(5)] for _ in range(4)]

    async def read_imu_frame(self):
        return {"accel": [0.0, 0.1, 9.8] * 3, "gyro": [0.0, 0.0, 0.0] * 3}

    async def read_status_frame(self):
        return {"battery": 0.87}


def test_backends_satisfy_protocol():
    assert isinstance(FakeAthenaBackend(), AthenaBackend)
    assert isinstance(AthenaBrainFlowBackend(), AthenaBackend)
    assert isinstance(AthenaLslBackend(), AthenaBackend)


@pytest.mark.parametrize(
    "backend_cls,expected_transport",
    [
        (AthenaBrainFlowBackend, "brainflow"),
        (AthenaLslBackend, "lsl"),
        (FakeAthenaBackend, "fake"),
    ],
)
def test_transport_metadata_board_id(backend_cls, expected_transport):
    meta = backend_cls().transport_metadata
    assert meta["transport"] == expected_transport
    assert meta["board_id"] == "MUSE_S_ATHENA_BOARD"


@pytest.mark.asyncio
async def test_adapter_assembles_sample_with_raw_optical():
    adapter = AthenaBlueAdapter(FakeAthenaBackend())
    assert await adapter.read_sample() is None  # not connected yet

    await adapter.connect()
    sample = await adapter.read_sample()

    assert isinstance(sample, AthenaSample)
    assert len(sample.eeg_buffer) == 4
    # Raw optical rows preserved first-class: 5 optodes.
    assert sample.optical_raw is not None
    assert len(sample.optical_raw) == 5
    assert sample.optical_sampling_rate_hz == ATHENA_OPT_FS
    assert sample.battery == pytest.approx(0.87)
    assert sample.modality_sampling_rates == {
        "eeg": ATHENA_EEG_FS,
        "optical": ATHENA_OPT_FS,
        "imu": ATHENA_IMU_FS,
    }
    assert sample.transport_metadata["board_id"] == "MUSE_S_ATHENA_BOARD"
    assert sample.accel_buffer is not None and len(sample.accel_buffer[0]) == 3

    await adapter.disconnect()
    assert not adapter.is_connected


@pytest.mark.asyncio
async def test_factory_builds_selected_backend(monkeypatch):
    from neurolink_v2.domain.device.backends import factory

    monkeypatch.setattr(factory.settings, "transport", "lsl", raising=False)
    assert isinstance(factory.build_backend(), AthenaLslBackend)
    assert isinstance(factory.build_backend("brainflow"), AthenaBrainFlowBackend)
    with pytest.raises(ValueError):
        factory.build_backend("bogus")
