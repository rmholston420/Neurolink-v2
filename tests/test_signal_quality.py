import pytest

from neurolink_v2.domain.signal.quality import classify_bandpower_quality


def test_insufficient_window_when_debug_missing():
    result = classify_bandpower_quality({})
    assert result["status"] == "insufficient-window"
    assert result["severity"] == 0
    assert "guidance" in result


def test_flat_signal_when_total_power_near_zero():
    debug = {
        "ok": True,
        "total_power": 0.0,
        "normalized": {"delta": 0.0, "theta": 0.0, "alpha": 0.0, "beta": 0.0, "gamma": 0.0},
    }
    result = classify_bandpower_quality(debug)
    assert result["status"] == "flat"
    assert result["severity"] == 1
    assert "guidance" in result


def test_artifact_likely_on_strong_fast_band():
    debug = {
        "ok": True,
        "total_power": 1.0,
        "normalized": {"delta": 0.05, "theta": 0.05, "alpha": 0.1, "beta": 0.4, "gamma": 0.4},
    }
    result = classify_bandpower_quality(debug)
    assert result["status"] == "artifact-likely"
    assert result["severity"] == 3
    assert "guidance" in result


def test_warn_on_elevated_fast_band_without_strong_alpha():
    debug = {
        "ok": True,
        "total_power": 1.0,
        "normalized": {"delta": 0.1, "theta": 0.1, "alpha": 0.2, "beta": 0.3, "gamma": 0.3},
    }
    result = classify_bandpower_quality(debug)
    assert result["status"] == "warn"
    assert result["severity"] == 2
    assert "guidance" in result


def test_good_for_alpha_forward_with_moderate_fast_band():
    debug = {
        "ok": True,
        "total_power": 1.0,
        "normalized": {"delta": 0.05, "theta": 0.05, "alpha": 0.45, "beta": 0.25, "gamma": 0.25},
    }
    result = classify_bandpower_quality(debug)
    assert result["status"] == "good"
    assert result["severity"] == 0
    assert "guidance" in result


def test_good_for_slow_dominant_with_low_fast_band():
    debug = {
        "ok": True,
        "total_power": 1.0,
        "normalized": {"delta": 0.35, "theta": 0.25, "alpha": 0.2, "beta": 0.1, "gamma": 0.1},
    }
    result = classify_bandpower_quality(debug)
    assert result["status"] == "good"
    assert result["severity"] == 0
    assert "guidance" in result
