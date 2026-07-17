"""Tests for per-frame derived hardware/state metrics."""

from __future__ import annotations

from dataclasses import dataclass

from neurolink_v2.domain.signal.frame_metrics import (
    compute_frame_metrics,
    summarize_artifacts,
    summarize_bad_channels,
)


@dataclass
class _Ann:
    artifact_type: str
    confidence: float


@dataclass
class _Stat:
    name: str
    is_bad: bool
    _reason: str

    def reason(self) -> str:
        return self._reason


def _flat_channel(value: float, n: int = 256) -> list[float]:
    return [value] * n


def _noisy_channel(amp: float, n: int = 256) -> list[float]:
    return [amp if i % 2 else -amp for i in range(n)]


def test_empty_inputs_return_empty_submaps():
    out = compute_frame_metrics(None, None, None)
    assert out["contact"] == {}
    assert out["impedance"] == {}
    assert out["focus_state"] in {"LOW", "MOD", "HIGH", "DISTRACTED"}
    assert 0.0 <= out["focus_score"] <= 1.0
    assert 0.0 <= out["fatigue"] <= 1.0


def test_contact_and_impedance_keyed_by_channel_name():
    eeg = {"0": _noisy_channel(20.0), "1": _noisy_channel(20.0)}
    names = ["TP9", "AF7"]
    out = compute_frame_metrics(eeg, names, {})
    assert set(out["contact"].keys()) == {"TP9", "AF7"}
    assert set(out["impedance"].keys()) == {"TP9", "AF7"}
    for v in out["contact"].values():
        assert 0.0 <= v <= 1.0
    for v in out["impedance"].values():
        assert v > 0.0


def test_flat_electrode_reads_high_impedance_low_contact():
    eeg = {"0": _flat_channel(0.0)}
    out = compute_frame_metrics(eeg, ["TP9"], {})
    assert out["contact"]["TP9"] == 0.0
    assert out["impedance"]["TP9"] >= 200.0


def test_healthy_rms_reads_low_impedance_high_contact():
    eeg = {"0": _noisy_channel(20.0)}
    out = compute_frame_metrics(eeg, ["TP9"], {})
    assert out["contact"]["TP9"] >= 0.5
    assert out["impedance"]["TP9"] < 60.0


def test_fallback_channel_names_when_names_absent():
    eeg = {"0": _noisy_channel(20.0), "1": _noisy_channel(20.0)}
    out = compute_frame_metrics(eeg, None, {})
    assert "TP9" in out["contact"]
    assert "AF7" in out["contact"]


def test_focus_state_high_when_engaged():
    bands = {"alpha": 0.1, "theta": 0.1, "beta": 0.4}
    out = compute_frame_metrics({}, None, bands)
    assert out["focus_state"] in {"HIGH", "DISTRACTED"}


def test_fatigue_rises_with_theta_over_alpha():
    low = compute_frame_metrics({}, None, {"alpha": 0.4, "theta": 0.05})["fatigue"]
    high = compute_frame_metrics({}, None, {"alpha": 0.1, "theta": 0.4})["fatigue"]
    assert high > low


def test_summarize_artifacts_clean_frame_all_zero():
    out = summarize_artifacts([])
    assert out == {
        "blink": 0.0,
        "emg": 0.0,
        "movement": 0.0,
        "saturation": 0.0,
        "drift": 0.0,
        "score": 0.0,
    }
    assert summarize_artifacts(None)["score"] == 0.0


def test_summarize_artifacts_maps_types_to_ui_classes():
    out = summarize_artifacts(
        [
            _Ann("BLINK", 0.4),
            _Ann("HORIZONTAL_EOG", 0.7),  # both fold into blink -> max wins
            _Ann("EMG", 0.5),
            _Ann("MOTION", 0.9),
            _Ann("ELECTRODE_POP", 0.3),
            _Ann("LINE_NOISE", 0.2),
            _Ann("CARDIAC", 0.6),  # both fold into drift -> max wins
        ]
    )
    assert out["blink"] == 0.7
    assert out["emg"] == 0.5
    assert out["movement"] == 0.9
    assert out["saturation"] == 0.3
    assert out["drift"] == 0.6
    assert out["score"] == 0.9


def test_summarize_artifacts_ignores_unknown_type():
    out = summarize_artifacts([_Ann("MYSTERY", 0.99)])
    assert out["score"] == 0.0


def test_summarize_bad_channels_flags_and_reasons():
    stats = [
        _Stat("TP9", False, "ok"),
        _Stat("AF7", True, "noisy"),
        _Stat("AF8", True, "manual,flat_line"),
    ]
    out = summarize_bad_channels(stats, interpolation_active=True)
    assert out["flagged"] == ["AF7", "AF8"]
    assert out["reasons"] == {"AF7": "noisy", "AF8": "manual,flat_line"}
    assert out["interpolation_active"] is True


def test_summarize_bad_channels_empty():
    out = summarize_bad_channels([], interpolation_active=False)
    assert out == {"flagged": [], "reasons": {}, "interpolation_active": False}
