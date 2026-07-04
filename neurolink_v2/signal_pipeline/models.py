from __future__ import annotations

from pydantic import BaseModel, Field


class LiveFrame(BaseModel):
    timestamp: float
    eeg_channels: list[int] = Field(default_factory=list)
    eeg: list[list[float]] = Field(default_factory=list)
    imu_shape: list[int] = Field(default_factory=list)
    anc_shape: list[int] = Field(default_factory=list)
    samples: int = 0
