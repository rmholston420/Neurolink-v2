"""Tests for the ported practice tracker (LCI + adaptive engine)."""

from __future__ import annotations

from neurolink_v2.domain.meditation.practice_tracker.adaptive_engine import (
    recommend_duration,
    recommend_technique,
)
from neurolink_v2.domain.meditation.practice_tracker.lci_service import LCIService


def test_recommend_technique_thresholds():
    assert recommend_technique(0.80) == "Dzogchen"
    assert recommend_technique(0.60) == "Tonglen"
    assert recommend_technique(0.40) == "Vipassana"
    assert recommend_technique(0.10) == "Shamatha"


def test_recommend_duration_scales_and_bonus():
    assert recommend_duration(0.10, 0) == 20
    assert recommend_duration(0.80, 0) == 45
    # count bonus only applies at mean_lci >= 0.5
    assert recommend_duration(0.60, 5) == 45  # 35 + 10
    assert recommend_duration(0.40, 5) == 25  # no bonus (< 0.5)


def test_lci_service_history_and_mean():
    svc = LCIService(maxlen=3)
    for v in (0.1, 0.2, 0.3, 0.4):
        svc.record(v)
    # maxlen=3 drops the oldest
    assert svc.history() == [0.2, 0.3, 0.4]
    assert abs(svc.mean() - 0.3) < 1e-9


def test_lci_service_empty_mean_zero():
    svc = LCIService()
    assert svc.mean() == 0.0
    assert svc.history() == []
