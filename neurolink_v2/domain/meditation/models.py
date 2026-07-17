"""Pydantic models for the meditation domain (ported from MuseLink)."""

from __future__ import annotations

import time
import uuid
from typing import Optional

from pydantic import BaseModel, Field


class HRVPayload(BaseModel):
    hr_bpm: float = 60.0
    hrv_rmssd: float = 0.0
    hrv_sdnn: float = 0.0
    hrv_pnn50: float = 0.0
    ibi_ms: list[float] = Field(default_factory=list)
    poincare: Optional[dict] = None


class IMUPayload(BaseModel):
    acc_x: float = 0.0
    acc_y: float = 0.0
    acc_z: float = 1.0
    gyro_x: float = 0.0
    gyro_y: float = 0.0
    gyro_z: float = 0.0
    motion_rms: float = 0.0


class EA1Result(BaseModel):
    score: float = 0.0
    label: str = "Ineligible"
    eligible: bool = False
    criteria_met: int = 0
    criteria_total: int = 5
    gates: dict = Field(default_factory=lambda: {"s_space": False, "motion": True})
    criteria: dict = Field(default_factory=dict)
    s_space_region: str = "A"
    overlay_mode: str = "X0"
    integration_coverage: float = 0.0


class IngestPayload(BaseModel):
    ts: float = Field(default_factory=time.time)
    alpha: float = 0.0
    theta: float = 0.0
    beta: float = 0.0
    delta: float = 0.0
    gamma: float = 0.0
    faa: Optional[float] = None
    fmt: Optional[float] = None
    ppg: Optional[HRVPayload] = None
    imu: Optional[IMUPayload] = None
    contact: list[int] = Field(default_factory=lambda: [0, 0, 0, 0])


class MeditationFrame(BaseModel):
    """Classifier output for one ingest frame."""

    ts: float
    alpha: float
    theta: float
    beta: float
    delta: float
    gamma: float
    faa: Optional[float] = None
    fmt: Optional[float] = None
    region: str
    alchemical_stage: str
    overlay_mode: str
    integration_coverage: float
    engagement_index: float
    ea1_result: Optional[EA1Result] = None
    hrv: Optional[HRVPayload] = None
    imu: Optional[IMUPayload] = None


class CalibrationRecord(BaseModel):
    id: Optional[int] = None
    created_at: str = ""
    label: str = "Baseline"
    alpha_base: float = 1.0
    theta_base: float = 1.0
    beta_base: float = 1.0
    delta_base: float = 1.0
    gamma_base: float = 1.0
    faa_base: float = 0.0


class SessionRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Untitled Session"
    state_name: str = "idle"
    created_at: str = ""
    closed_at: Optional[str] = None
    notes: list[str] = Field(default_factory=list)
    active: bool = True
