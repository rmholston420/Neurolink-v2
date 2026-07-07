from __future__ import annotations

from typing import Any, Dict

_GUIDANCE = {
    "insufficient-window": "Waiting for enough EEG samples — hold still for 2 seconds.",
    "flat": "No signal detected. Check headset fit and ensure electrodes contact skin.",
    "artifact-likely": "Strong muscle artifact. Relax your jaw, soften your forehead, and avoid swallowing or eye movement.",
    "warn": "Elevated fast-band activity. Reduce facial tension, sit quietly, and breathe slowly.",
    "good": "Signal quality is good. You may begin your session.",
}



def classify_bandpower_quality(debug: Dict[str, Any]) -> Dict[str, Any]:
    if not debug or not debug.get("ok"):
        return {
            "status": "insufficient-window",
            "reason": "No valid PSD window",
            "severity": 0,
            "guidance": _GUIDANCE["insufficient-window"],
        }

    total_power = float(debug.get("total_power", 0.0))
    normalized = debug.get("normalized", {}) or {}

    delta = float(normalized.get("delta", 0.0))
    theta = float(normalized.get("theta", 0.0))
    alpha = float(normalized.get("alpha", 0.0))
    beta = float(normalized.get("beta", 0.0))
    gamma = float(normalized.get("gamma", 0.0))

    fast = beta + gamma
    slow = delta + theta

    if total_power <= 1e-12:
        return {
            "status": "flat",
            "reason": "No measurable band power",
            "severity": 1,
            "guidance": _GUIDANCE["flat"],
        }

    if gamma >= 0.45 or fast >= 0.80:
        return {
            "status": "artifact-likely",
            "reason": "High beta/gamma contamination",
            "severity": 3,
            "guidance": _GUIDANCE["artifact-likely"],
        }

    alpha_forward_candidate = alpha >= 0.35 and beta > 0.0 and (alpha / (alpha + beta)) >= 0.42

    if gamma >= 0.30 or fast >= 0.60:
        if alpha_forward_candidate and gamma < 0.35 and fast < 0.65:
            return {
                "status": "good",
                "reason": "Alpha-forward spectrum with only moderate fast-band activity",
                "severity": 0,
                "guidance": _GUIDANCE["good"],
            }
        return {
            "status": "warn",
            "reason": "Elevated fast-band activity",
            "severity": 2,
            "guidance": _GUIDANCE["warn"],
        }

    if alpha >= 0.35 and fast < 0.45:
        return {
            "status": "good",
            "reason": "Stable alpha-weighted spectrum",
            "severity": 0,
            "guidance": _GUIDANCE["good"],
        }

    if slow >= 0.50 and fast < 0.45:
        return {
            "status": "good",
            "reason": "Stable slow-band weighted spectrum",
            "severity": 0,
            "guidance": _GUIDANCE["good"],
        }

    return {
        "status": "good",
        "reason": "Usable spectral distribution",
        "severity": 0,
        "guidance": _GUIDANCE["good"],
    }

def compute_session_guidance(
    slow_over_total: float,
    fast_over_total: float,
    alpha_over_alpha_beta: float,
    overall_quality: str,
) -> dict:
    """
    Derive conservative session-level guidance from hardened spectral ratios.

    overall_quality should be a coarse label such as:
    'excellent', 'good', 'fair', 'poor', or 'unknown'
    """
    quality_rank = {
        "excellent": 3,
        "good": 2,
        "fair": 1,
        "poor": 0,
        "unknown": 0,
    }
    q_score = quality_rank.get((overall_quality or "unknown").lower(), 0)

    fast_band_risk = fast_over_total > 0.5 and q_score <= 1
    slow_band_dominant = slow_over_total > 0.6 and q_score >= 1
    alpha_forward = alpha_over_alpha_beta > 0.4 and not fast_band_risk

    if fast_band_risk:
        guidance_hint = (
            "Fast-band power is dominant with less-than-ideal quality. "
            "Relax jaw and facial muscles, soften the forehead, and check that "
            "TP9/TP10 are comfortably seated."
        )
    elif slow_band_dominant and not alpha_forward:
        guidance_hint = (
            "Slow bands dominate with acceptable quality. Body is relaxed; "
            "if you feel drowsy, gently brighten attention while keeping tension low."
        )
    elif alpha_forward:
        guidance_hint = (
            "Alpha is strong relative to beta with acceptable quality. "
            "Continue steady, relaxed attention rather than chasing metrics."
        )
    else:
        guidance_hint = (
            "Mixed spectral profile. Focus on comfort, breathing, and headset seating "
            "before interpreting band ratios."
        )

    return {
        "fast_band_risk": fast_band_risk,
        "slow_band_dominant": slow_band_dominant,
        "alpha_forward": alpha_forward,
        "guidance_hint": guidance_hint,
    }

