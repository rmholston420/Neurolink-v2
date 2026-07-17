"""Adaptive session recommender (ported from MuseLink).

Maps the rolling mean LCI (Luminous Clarity Index) to a meditation technique
and a recommended session duration in minutes.
"""

from __future__ import annotations

_TECHNIQUE_THRESHOLDS: list[tuple[float, str]] = [
    (0.75, "Dzogchen"),
    (0.55, "Tonglen"),
    (0.35, "Vipassana"),
    (0.00, "Shamatha"),
]


def recommend_technique(mean_lci: float) -> str:
    for threshold, tech in _TECHNIQUE_THRESHOLDS:
        if mean_lci >= threshold:
            return tech
    return "Shamatha"


def recommend_duration(mean_lci: float, recent_count: int) -> int:
    base = 20
    if mean_lci >= 0.75:
        base = 45
    elif mean_lci >= 0.55:
        base = 35
    elif mean_lci >= 0.35:
        base = 25
    if recent_count >= 5 and mean_lci >= 0.5:
        base += 10
    return base
