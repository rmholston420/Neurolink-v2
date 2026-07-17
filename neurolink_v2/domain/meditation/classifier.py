"""S-space region classifier and alchemical-stage mapping (ported from MuseLink).

Regions A–H are assigned from normalised alpha/theta band powers; each region
maps to an alchemical stage and an overlay mode (X0–X7). ``engagement_index``
and ``integration_coverage`` are derived scalars used by the meditation UI.
"""

from __future__ import annotations

# S-space regions A-H based on alpha/theta thresholds (checked high→low).
_REGIONS: list[tuple[str, float, float]] = [
    ("H", 0.70, 0.70),  # high alpha, high theta
    ("G", 0.70, 0.40),
    ("F", 0.70, 0.20),
    ("E", 0.50, 0.70),
    ("D", 0.50, 0.40),
    ("C", 0.50, 0.20),
    ("B", 0.30, 0.40),
    ("A", 0.00, 0.00),  # default / low
]

_STAGE_MAP: dict[str, str] = {
    "A": "Nigredo",
    "B": "Albedo",
    "C": "Citrinitas",
    "D": "Citrinitas",
    "E": "Rubedo",
    "F": "Rubedo",
    "G": "Conjunctio",
    "H": "Conjunctio",
}

_OVERLAY_MAP: dict[str, str] = {
    "A": "X0",
    "B": "X1",
    "C": "X2",
    "D": "X3",
    "E": "X4",
    "F": "X5",
    "G": "X6",
    "H": "X7",
}


def s_space_region(alpha: float, theta: float) -> str:
    norm_a = min(alpha / 2.0, 1.0)
    norm_t = min(theta / 2.0, 1.0)
    for region, a_thresh, t_thresh in _REGIONS:
        if norm_a >= a_thresh and norm_t >= t_thresh:
            return region
    return "A"


def alchemical_stage(region: str) -> str:
    return _STAGE_MAP.get(region, "Nigredo")


def overlay_mode(region: str) -> str:
    return _OVERLAY_MAP.get(region, "X0")


def engagement_index(alpha: float, theta: float, beta: float) -> float:
    denom = alpha + theta
    if denom < 1e-9:
        return 0.0
    return min(beta / denom, 1.0)


def integration_coverage(region: str, eng: float, faa: float | None) -> float:
    region_score = (ord(region) - ord("A")) / 7.0
    faa_bonus = 0.0
    if faa is not None and faa > 0:
        faa_bonus = min(faa * 0.3, 0.15)
    return min(region_score * 0.6 + eng * 0.25 + faa_bonus, 1.0)


def classify(payload) -> dict:
    """Classify one ingest payload into the full meditation frame fields.

    ``payload`` is any object exposing ``alpha``/``theta``/``beta``/``faa``
    attributes (e.g. :class:`IngestPayload`). Returns a dict of the derived
    region / stage / overlay / engagement / integration-coverage values.
    """
    region = s_space_region(payload.alpha, payload.theta)
    eng = engagement_index(payload.alpha, payload.theta, payload.beta)
    return {
        "region": region,
        "alchemical_stage": alchemical_stage(region),
        "overlay_mode": overlay_mode(region),
        "engagement_index": round(eng, 4),
        "integration_coverage": round(
            integration_coverage(region, eng, payload.faa), 4
        ),
    }
