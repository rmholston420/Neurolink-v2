"""Tests for the ported meditation classifier + EA-1 scorer."""

from __future__ import annotations

from neurolink_v2.domain.meditation import classifier
from neurolink_v2.domain.meditation.ea1_scorer import score_ea1
from neurolink_v2.domain.meditation.models import HRVPayload, IMUPayload, IngestPayload


def test_low_bands_default_region_a():
    assert classifier.s_space_region(0.0, 0.0) == "A"
    assert classifier.alchemical_stage("A") == "Nigredo"
    assert classifier.overlay_mode("A") == "X0"


def test_high_alpha_high_theta_region_h():
    # norm = min(v/2, 1); need norm_a>=0.70 and norm_t>=0.70 -> raw >= 1.4
    assert classifier.s_space_region(1.5, 1.5) == "H"
    assert classifier.alchemical_stage("H") == "Conjunctio"
    assert classifier.overlay_mode("H") == "X7"


def test_engagement_index_bounds():
    assert classifier.engagement_index(0.0, 0.0, 1.0) == 0.0
    assert classifier.engagement_index(1.0, 1.0, 10.0) == 1.0
    assert 0.0 < classifier.engagement_index(0.5, 0.5, 0.5) <= 1.0


def test_integration_coverage_increases_with_region():
    low = classifier.integration_coverage("A", 0.0, None)
    high = classifier.integration_coverage("H", 0.0, None)
    assert high > low


def test_classify_payload_shape():
    payload = IngestPayload(alpha=1.5, theta=1.5, beta=0.3, faa=0.2)
    out = classifier.classify(payload)
    assert out["region"] == "H"
    assert out["alchemical_stage"] == "Conjunctio"
    assert out["overlay_mode"] == "X7"
    assert 0.0 <= out["integration_coverage"] <= 1.0


def test_ea1_ineligible_when_region_gate_closed():
    # Region A is not in the {E,F,G,H} gate -> score 0 regardless of soft criteria.
    ppg = HRVPayload(hrv_rmssd=60.0, hr_bpm=6.0, poincare={"sd1_sd2_ratio": 0.9})
    result = score_ea1("A", IMUPayload(motion_rms=0.0), ppg, faa=0.5, fmt=0.5)
    assert result.eligible is False
    assert result.score == 0.0
    assert result.gates["s_space"] is False


def test_ea1_peak_coherence_all_criteria():
    ppg = HRVPayload(hrv_rmssd=60.0, hr_bpm=6.0, poincare={"sd1_sd2_ratio": 0.9})
    result = score_ea1("H", IMUPayload(motion_rms=0.0), ppg, faa=0.5, fmt=0.5)
    assert result.eligible is True
    assert result.criteria_met == 5
    assert result.label == "Peak Coherence"
    assert result.overlay_mode == "X7"


def test_ea1_motion_gate_blocks():
    ppg = HRVPayload(hrv_rmssd=60.0, hr_bpm=6.0, poincare={"sd1_sd2_ratio": 0.9})
    result = score_ea1("H", IMUPayload(motion_rms=0.5), ppg, faa=0.5, fmt=0.5)
    assert result.eligible is False
    assert result.gates["motion"] is False
