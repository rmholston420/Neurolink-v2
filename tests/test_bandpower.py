"""Unit tests for the band-power computation."""

import math
import numpy as np
import pytest

from neurolink_v2.domain.signal.bandpower import compute_band_powers, BANDS


def _sine_wave(freq_hz: float, duration_s: float = 2.0, sample_rate: int = 256) -> list:
    t = np.linspace(0, duration_s, int(duration_s * sample_rate), endpoint=False)
    return (100.0 * np.sin(2 * math.pi * freq_hz * t)).tolist()


def test_alpha_dominant():
    """A 10 Hz sine should yield the highest relative power in the alpha band."""
    samples = _sine_wave(10.0)
    powers = compute_band_powers(samples)
    assert powers["alpha"] == max(powers.values()), (
        f"Expected alpha to dominate, got: {powers}"
    )


def test_theta_dominant():
    samples = _sine_wave(6.0)
    powers = compute_band_powers(samples)
    assert powers["theta"] == max(powers.values())


def test_powers_sum_to_one():
    samples = _sine_wave(10.0)
    powers = compute_band_powers(samples)
    total = sum(powers.values())
    assert abs(total - 1.0) < 0.01


def test_short_input_returns_zeros():
    powers = compute_band_powers([1.0, 2.0, 3.0])
    assert all(v == 0.0 for v in powers.values())
