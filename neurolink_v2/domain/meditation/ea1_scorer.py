"""EA-1 Gate Scorer — MuseLink 5-criterion variant (ported).

Five soft criteria (HRV RMSSD, breathing rate, FAA, FMt, Poincaré ratio) plus
two hard gates (s-space region ∈ {E,F,G,H}, head motion). Eligibility requires
≥ 3 soft criteria *and* both hard gates. Labels escalate with criteria met.
"""

from __future__ import annotations

from neurolink_v2.domain.meditation.models import EA1Result, HRVPayload, IMUPayload

_HRV_RMSSD_MIN = 40.0  # ms
_BREATH_MIN = 4.0  # BPM
_BREATH_MAX = 8.0
_FAA_MIN = 0.0  # positive = left-alpha dominance
_FMT_MIN = 0.15  # frontal-midline theta power
_POINCARE_MIN = 0.70  # sd1/sd2 ratio
_MOTION_MAX = 0.10  # g-unit RMS
_S_SPACE_GATE = {"E", "F", "G", "H"}  # regions that open EA-1


def score_ea1(
    region: str,
    imu: IMUPayload | None,
    ppg: HRVPayload | None,
    faa: float | None,
    fmt: float | None,
) -> EA1Result:
    # Hard gates
    gate_s_space = region in _S_SPACE_GATE
    gate_motion = (imu.motion_rms <= _MOTION_MAX) if imu else True

    # Soft criteria
    c_hrv = ppg.hrv_rmssd >= _HRV_RMSSD_MIN if ppg else False
    c_breath = bool(ppg and _BREATH_MIN <= ppg.hr_bpm <= _BREATH_MAX)
    c_faa = faa is not None and faa > _FAA_MIN
    c_fmt = fmt is not None and fmt >= _FMT_MIN
    c_poincare = bool(
        ppg and ppg.poincare and ppg.poincare.get("sd1_sd2_ratio", 0.0) >= _POINCARE_MIN
    )

    criteria = {
        "hrv_rmssd": {
            "value": ppg.hrv_rmssd if ppg else None,
            "threshold": _HRV_RMSSD_MIN,
            "units": "ms",
            "met": c_hrv,
        },
        "rr_bpm": {
            "value": ppg.hr_bpm if ppg else None,
            "threshold": None,
            "range": [_BREATH_MIN, _BREATH_MAX],
            "units": "BPM",
            "met": c_breath,
        },
        "faa": {"value": faa, "threshold": _FAA_MIN, "units": "", "met": c_faa},
        "fmt": {"value": fmt, "threshold": _FMT_MIN, "units": "", "met": c_fmt},
        "poincare_ratio": {
            "value": ppg.poincare.get("sd1_sd2_ratio") if ppg and ppg.poincare else None,
            "threshold": _POINCARE_MIN,
            "units": "",
            "met": c_poincare,
        },
    }

    criteria_met = sum([c_hrv, c_breath, c_faa, c_fmt, c_poincare])

    if not gate_s_space or not gate_motion:
        score = 0.0
        eligible = False
    else:
        score = criteria_met / 5.0
        eligible = criteria_met >= 3

    if eligible and criteria_met == 5:
        label = "Peak Coherence"
    elif eligible and criteria_met >= 4:
        label = "Deep Coherence"
    elif eligible:
        label = "EA1 Eligible"
    else:
        label = "Ineligible"

    return EA1Result(
        score=round(score, 4),
        label=label,
        eligible=eligible,
        criteria_met=criteria_met,
        criteria_total=5,
        gates={"s_space": gate_s_space, "motion": gate_motion},
        criteria=criteria,
        s_space_region=region,
        overlay_mode=f"X{ord(region) - ord('A')}",
        integration_coverage=round(score * 0.8, 4),
    )
