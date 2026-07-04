"""EEG band-power computation using BrainFlow's built-in DataFilter.

Bands
-----
Delta  0.5 –  4 Hz   (deep sleep, slow waves)
Theta  4   –  8 Hz   (drowsiness, meditation)
Alpha  8   – 13 Hz   (relaxed awareness, Alpha Peak)
Beta  13   – 30 Hz   (active thinking, focus)
Gamma 30   – 100 Hz  (high cognition)
"""

import numpy as np
from brainflow.data_filter import DataFilter, DetrendOperations, FilterTypes

SAMPLE_RATE = 256  # Muse S Athena EEG sample rate (Hz)

BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 100.0),
}


def compute_band_powers(samples: list[float]) -> dict[str, float]:
    """Return relative band powers (0-1) for a single EEG channel.

    Parameters
    ----------
    samples:
        Raw µV samples from one EEG channel (at least 256 samples recommended).

    Returns
    -------
    dict mapping band name to relative power (fraction of total power).
    """
    if len(samples) < 32:
        return {b: 0.0 for b in BANDS}

    data = np.array(samples, dtype=np.float64)

    # Detrend to remove DC offset
    DataFilter.detrend(data, DetrendOperations.CONSTANT.value)

    powers = {}
    for band, (low, high) in BANDS.items():
        band_power = DataFilter.get_band_power(
            data, low, high, SAMPLE_RATE, apply_filters=True
        )
        powers[band] = float(band_power)

    total = sum(powers.values()) or 1.0
    return {band: round(p / total, 4) for band, p in powers.items()}


def compute_alpha_peak(samples: list[float]) -> float:
    """Estimate the dominant frequency within the alpha band (8-13 Hz).

    Returns the peak frequency in Hz, or 0.0 if insufficient data.
    """
    if len(samples) < 256:
        return 0.0
    data = np.array(samples, dtype=np.float64)
    DataFilter.detrend(data, DetrendOperations.CONSTANT.value)
    # BrainFlow get_band_power with narrow bins
    peak = 0.0
    max_power = -1.0
    for f in np.arange(8.0, 13.1, 0.5):
        p = DataFilter.get_band_power(data, f, f + 0.5, SAMPLE_RATE, apply_filters=True)
        if p > max_power:
            max_power = p
            peak = f
    return float(peak)
