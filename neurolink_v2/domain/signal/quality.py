from __future__ import annotations

from typing import Any, Dict


def classify_bandpower_quality(debug: Dict[str, Any]) -> Dict[str, Any]:
    if not debug or not debug.get("ok"):
        return {
            "status": "insufficient-window",
            "reason": "No valid PSD window",
            "severity": 0,
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
        }

    if gamma >= 0.45 or fast >= 0.80:
        return {
            "status": "artifact-likely",
            "reason": "High beta/gamma contamination",
            "severity": 3,
        }

    if gamma >= 0.30 or fast >= 0.60:
        return {
            "status": "warn",
            "reason": "Elevated fast-band activity",
            "severity": 2,
        }

    if alpha >= 0.35 and fast < 0.45:
        return {
            "status": "good",
            "reason": "Stable alpha-weighted spectrum",
            "severity": 0,
        }

    if slow >= 0.50 and fast < 0.45:
        return {
            "status": "good",
            "reason": "Stable slow-band weighted spectrum",
            "severity": 0,
        }

    return {
        "status": "good",
        "reason": "Usable spectral distribution",
        "severity": 0,
    }
