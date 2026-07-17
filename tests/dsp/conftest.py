"""Fixtures for the ported DSP unit tests (Athena-only).

Ported from Neurolink-v1 ``backend/tests/conftest.py``, trimmed to the
DSP-only fixtures (no hub / FastAPI app dependencies).
"""

from __future__ import annotations

import numpy as np
import pytest

from neurolink_v2.domain.signal.dsp.models import BandPowers, IngestPayload


@pytest.fixture()
def flat_bands() -> BandPowers:
    return BandPowers(alpha=0.2, theta=0.2, beta=0.2, delta=0.2, gamma=0.2)


@pytest.fixture()
def alpha_dominant_bands() -> BandPowers:
    return BandPowers(alpha=0.55, theta=0.15, beta=0.15, delta=0.10, gamma=0.05)


@pytest.fixture()
def base_payload(flat_bands) -> IngestPayload:
    return IngestPayload(source="athena", bands=flat_bands)


@pytest.fixture()
def eeg_buffer_256hz() -> list[list[float]]:
    rng = np.random.default_rng(42)
    t = np.linspace(0, 1, 256)
    channels = [
        np.sin(2 * np.pi * 10 * t) + 0.1 * rng.standard_normal(256),
        np.sin(2 * np.pi * 6 * t) + 0.1 * rng.standard_normal(256),
        np.sin(2 * np.pi * 20 * t) + 0.1 * rng.standard_normal(256),
        np.sin(2 * np.pi * 2 * t) + 0.1 * rng.standard_normal(256),
    ]
    return [ch.tolist() for ch in channels]
