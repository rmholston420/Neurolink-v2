"""EEG band-power computation using BrainFlow PSD utilities.

Bands
-----
Delta  0.5 –  4 Hz
Theta  4   –  8 Hz
Alpha  8   – 13 Hz
Beta  13   – 30 Hz
Gamma 30   – 45 Hz
"""

import numpy as np
from brainflow.data_filter import DataFilter, DetrendOperations, WindowOperations

SAMPLE_RATE = 256  # Muse S Athena EEG sample rate (Hz)

BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}


def _psd_for(samples: list[float]):
    data = np.array(samples, dtype=np.float64)
    DataFilter.detrend(data, DetrendOperations.CONSTANT.value)
    nfft = DataFilter.get_nearest_power_of_two(len(data))
    if nfft < 8:
        nfft = 8
    usable = data[-nfft:]
    return DataFilter.get_psd_welch(
        usable,
        nfft,
        nfft // 2,
        SAMPLE_RATE,
        WindowOperations.HANNING.value,
    )


def compute_band_powers(samples: list[float]) -> dict[str, float]:
    """Return relative band powers (0-1) for a single EEG channel."""
    if len(samples) < 64:
        return {b: 0.0 for b in BANDS}

    psd = _psd_for(samples)
    powers = {
        band: float(DataFilter.get_band_power(psd, low, high))
        for band, (low, high) in BANDS.items()
    }
    total = sum(powers.values()) or 1.0
    return {band: round(p / total, 4) for band, p in powers.items()}


def compute_alpha_peak(samples: list[float]) -> float:
    """Estimate the dominant frequency within the alpha band (8-13 Hz)."""
    if len(samples) < 128:
        return 0.0

    psd = _psd_for(samples)
    amplitudes, freqs = psd
    alpha_pairs = [(freq, amp) for amp, freq in zip(amplitudes, freqs) if 8.0 <= freq <= 13.0]
    if not alpha_pairs:
        return 0.0

    peak_freq, _ = max(alpha_pairs, key=lambda item: item[1])
    return float(round(peak_freq, 2))
