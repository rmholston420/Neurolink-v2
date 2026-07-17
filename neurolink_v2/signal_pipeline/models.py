from __future__ import annotations

from pydantic import BaseModel, Field


class OpticalPayload(BaseModel):
    """Raw frontal fNIRS optical rows from Muse Athena.

    Athena's 5-optode frontal array streams at 3 wavelengths (850 / 730 / 660 nm).
    These rows are preserved verbatim as ``optical_raw`` -- one inner list per
    optical channel, oldest sample first.  This is NOT PPG and must never be
    downsampled or overwritten by a PPG-only pipeline.
    """

    optical_raw: list[list[float]] = Field(default_factory=list)
    sampling_rate_hz: float | None = None


class LiveFrame(BaseModel):
    timestamp: float
    eeg_channels: list[int] = Field(default_factory=list)
    eeg: list[list[float]] = Field(default_factory=list)
    imu_shape: list[int] = Field(default_factory=list)
    anc_shape: list[int] = Field(default_factory=list)
    samples: int = 0

    # --- transport abstraction (PR: feature/brainflow-athena-backend) ---
    optical_buffer: OpticalPayload | None = None
    optical_sampling_rate_hz: float | None = None
    modality_sampling_rates: dict[str, float] = Field(default_factory=dict)
    transport_metadata: dict[str, str] = Field(default_factory=dict)
