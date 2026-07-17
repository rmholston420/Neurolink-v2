"""Per-frame derived hardware/state metrics for the live WS EEG frame.

These are additive fields attached to the broadcast EEG snapshot so the Tier-A
visualization components (ContactQuality, ImpedancePanel, FocusFatigueGauge)
bind to real values instead of mocks.

Everything here is computed from data the broadcaster already has:
  * ``eeg`` — raw per-channel sample buffers (µV) from ``get_eeg_snapshot``
  * ``bands`` — mean band-power fractions from the DSP pipeline result

Muse Athena does not expose a direct impedance channel over BrainFlow, so the
impedance readout is an explicit *heuristic proxy* derived from raw-signal RMS:
a flat/disconnected electrode (very low RMS) and a railing/noisy electrode
(very high RMS) both map to high kΩ, while a healthy EEG RMS maps to low kΩ.
The value is labelled as an estimate in the UI — it is never fabricated.
"""

from __future__ import annotations

from statistics import fmean, pstdev
from typing import Sequence

# Healthy scalp-EEG RMS band (µV). Athena frontal electrodes typically sit here.
_RMS_IDEAL = 20.0
_RMS_MIN_OK = 4.0
_RMS_MAX_OK = 60.0
# Impedance proxy anchors (kΩ) — heuristic, see module docstring.
_KOHM_IDEAL = 8.0
_KOHM_MAX = 250.0

_FALLBACK_NAMES = ["TP9", "AF7", "AF8", "TP10"]  # TODO: verify Athena channel names


def _rms(samples: Sequence[float]) -> float:
    if not samples:
        return 0.0
    # RMS about the mean == population standard deviation.
    try:
        return float(pstdev(samples)) if len(samples) > 1 else abs(float(samples[0]))
    except Exception:
        return 0.0


def _contact_score(rms: float) -> float:
    """Map raw-signal RMS (µV) to a [0, 1] contact-quality score."""
    if rms <= 0.0:
        return 0.0
    if rms < _RMS_MIN_OK:
        # Near-flat: fading toward disconnected.
        return max(0.0, rms / _RMS_MIN_OK) * 0.4
    if rms <= _RMS_MAX_OK:
        # Healthy plateau centred on the ideal RMS.
        span = _RMS_MAX_OK - _RMS_MIN_OK
        dist = abs(rms - _RMS_IDEAL) / span
        return max(0.5, 1.0 - dist)
    # Above the healthy band: motion / railing / line noise.
    over = min(1.0, (rms - _RMS_MAX_OK) / _RMS_MAX_OK)
    return max(0.05, 0.5 * (1.0 - over))


def _impedance_kohm(rms: float) -> float:
    """Heuristic per-channel impedance estimate (kΩ) from raw-signal RMS."""
    if rms <= 0.0:
        return _KOHM_MAX
    if rms < _RMS_MIN_OK:
        # Flat electrode → poor contact → high impedance.
        frac = 1.0 - max(0.0, rms / _RMS_MIN_OK)
        return _KOHM_IDEAL + frac * (_KOHM_MAX - _KOHM_IDEAL)
    if rms <= _RMS_MAX_OK:
        dist = abs(rms - _RMS_IDEAL) / (_RMS_MAX_OK - _RMS_MIN_OK)
        return round(_KOHM_IDEAL + dist * 40.0, 1)
    over = min(1.0, (rms - _RMS_MAX_OK) / _RMS_MAX_OK)
    return round(_KOHM_IDEAL + 40.0 + over * (_KOHM_MAX - _KOHM_IDEAL - 40.0), 1)


def _focus(bands: dict[str, float]) -> tuple[str, float]:
    """Classify focus state + score from mean band powers.

    Engagement index = beta / (alpha + theta) (Pope et al.). Higher beta with
    controlled alpha/theta reads as engaged focus; runaway beta with low
    alpha/theta reads as distracted arousal.
    """
    alpha = float(bands.get("alpha", 0.0))
    theta = float(bands.get("theta", 0.0))
    beta = float(bands.get("beta", 0.0))
    denom = alpha + theta + 1e-6
    engagement = beta / denom
    score = max(0.0, min(1.0, engagement / 2.0))
    if beta > 0.35 and engagement > 1.6:
        return "DISTRACTED", score
    if engagement >= 0.9:
        return "HIGH", score
    if engagement >= 0.45:
        return "MOD", score
    return "LOW", score


def _fatigue(bands: dict[str, float]) -> float:
    """Fatigue proxy = theta / alpha ratio, squashed to [0, 1]."""
    alpha = float(bands.get("alpha", 0.0))
    theta = float(bands.get("theta", 0.0))
    ratio = theta / (alpha + 1e-6)
    return max(0.0, min(1.0, ratio / 3.0))


def compute_frame_metrics(
    eeg_map: dict[str, list[float]] | None,
    channel_names: list[str] | None,
    bands: dict[str, float] | None,
) -> dict:
    """Return per-frame contact/impedance/focus/fatigue metrics.

    ``contact`` and ``impedance`` are keyed by channel name (falling back to the
    Athena frontal-4 labels). ``focus_state``/``focus_score``/``fatigue`` derive
    from the mean band powers. Returns empty sub-maps when no EEG is present so
    callers never invent data.
    """
    eeg_map = eeg_map or {}
    bands = bands or {}
    keys = list(eeg_map.keys())
    names = channel_names or []

    contact: dict[str, float] = {}
    impedance: dict[str, float] = {}
    for idx, key in enumerate(keys):
        label = names[idx] if idx < len(names) else (
            _FALLBACK_NAMES[idx] if idx < len(_FALLBACK_NAMES) else key
        )
        rms = _rms(eeg_map[key])
        contact[label] = round(_contact_score(rms), 3)
        impedance[label] = _impedance_kohm(rms)

    focus_state, focus_score = _focus(bands)
    return {
        "contact": contact,
        "impedance": impedance,
        "focus_state": focus_state,
        "focus_score": round(focus_score, 3),
        "fatigue": round(_fatigue(bands), 3),
    }
