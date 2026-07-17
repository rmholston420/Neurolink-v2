"""Tests for per-frame derived hardware/state metrics."""

from __future__ import annotations

from neurolink_v2.domain.signal.frame_metrics import compute_frame_metrics


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
