"""Artefact rejection helpers.

Simple amplitude-threshold approach: samples outside ±150 µV are
flagged as artefacts (eye blinks, jaw clench, electrode pop-off).
For a meditation / neurofeedback app this is sufficient as a first pass;
a proper ICA pipeline can be added in a future domain slice.
"""

from typing import List

ARTEFACT_THRESHOLD_UV = 150.0  # µV


def is_artefact_epoch(epoch: List[float]) -> bool:
    """Return True if any sample in *epoch* exceeds the threshold."""
    return any(abs(v) > ARTEFACT_THRESHOLD_UV for v in epoch)


def flag_artefacts(samples: List[float]) -> List[bool]:
    """Return a per-sample boolean mask: True = artefact."""
    return [abs(v) > ARTEFACT_THRESHOLD_UV for v in samples]
