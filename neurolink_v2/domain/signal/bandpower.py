from __future__ import annotations

from typing import Dict, Any

import numpy as np
from brainflow.data_filter import DataFilter, WindowOperations
from brainflow.exit_codes import BrainFlowError

SAMPLERATE = 256
MIN_SAMPLES = 128
MAX_WINDOW_SAMPLES = 512

BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}


def _zero_bands() -> Dict[str, float]:
    return {name: 0.0 for name in BANDS}


def _safe_window(samples) -> np.ndarray:
    data = np.asarray(samples, dtype=np.float64).flatten()
    if data.size == 0:
        return data
    return data[-min(data.size, MAX_WINDOW_SAMPLES):]


def _prepare_psd_input(samples) -> tuple[np.ndarray, int] | tuple[None, None]:
    data = _safe_window(samples)
    if data.size < MIN_SAMPLES:
        return None, None

    data = data - np.mean(data)
    nfft = DataFilter.get_nearest_power_of_two(data.size)

    if nfft < MIN_SAMPLES or nfft > data.size:
        return None, None

    window = np.ascontiguousarray(data[-nfft:], dtype=np.float64)
    return window, nfft


def compute_band_powers_raw(samples) -> Dict[str, float]:
    prepared = _prepare_psd_input(samples)
    if prepared[0] is None:
        return _zero_bands()

    window, nfft = prepared
    try:
        psd = DataFilter.get_psd_welch(
            window,
            nfft,
            nfft // 2,
            SAMPLERATE,
            WindowOperations.BLACKMAN_HARRIS.value,
        )
    except BrainFlowError:
        return _zero_bands()
    except Exception:
        return _zero_bands()

    raw = {}
    for name, (low, high) in BANDS.items():
        try:
            power = float(DataFilter.get_band_power(psd, low, high))
        except Exception:
            power = 0.0
        raw[name] = max(power, 0.0)

    return raw


def normalize_band_powers(raw: Dict[str, float]) -> Dict[str, float]:
    total = float(sum(max(float(v), 0.0) for v in raw.values()))
    if total <= 1e-12:
        return _zero_bands()
    return {name: round(max(float(raw.get(name, 0.0)), 0.0) / total, 6) for name in BANDS}


def compute_band_powers(samples) -> Dict[str, float]:
    raw = compute_band_powers_raw(samples)
    return normalize_band_powers(raw)


def compute_band_powers_debug(samples) -> Dict[str, Any]:
    prepared = _prepare_psd_input(samples)
    if prepared[0] is None:
        return {
            "ok": False,
            "sample_rate": SAMPLERATE,
            "window_samples": int(len(_safe_window(samples))),
            "nfft": 0,
            "total_power": 0.0,
            "raw": _zero_bands(),
            "normalized": _zero_bands(),
        }

    window, nfft = prepared
    raw = compute_band_powers_raw(window)
    normalized = normalize_band_powers(raw)
    total_power = float(sum(raw.values()))

    return {
        "ok": total_power > 1e-12,
        "sample_rate": SAMPLERATE,
        "window_samples": int(len(window)),
        "nfft": int(nfft),
        "total_power": round(total_power, 12),
        "raw": {k: round(float(v), 12) for k, v in raw.items()},
        "normalized": normalized,
    }


def computebandpowers(samples) -> Dict[str, float]:
    return compute_band_powers(samples)
