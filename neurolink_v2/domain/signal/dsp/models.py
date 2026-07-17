"""Data models for the DSP stack (ported from Neurolink-v1 models/eeg.py).

Athena-only.  The v1 API request/response models that carried non-Athena
device defaults were intentionally dropped on port; only the internal DSP data
transfer objects live here.  ``EEGSample`` is ported from v1's
``hardware/base.py`` so the pipeline consumes a stable frame contract.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field


# ============================================================================
# Sub-models
# ============================================================================


class BandPowers(BaseModel):
    """EEG band power fractions. All values in [0, 1]."""

    alpha: float = 0.0
    theta: float = 0.0
    beta: float = 0.0
    delta: float = 0.0
    gamma: float = 0.0


class SSpaceCoords(BaseModel):
    """S-space (EEG mandala) coordinates."""

    x: float = 0.0  # engagement index
    y: float = 0.0  # integration coverage
    z: float = 0.0  # gamma index


class IMUPayload(BaseModel):
    """IMU-derived head pose and motion data."""

    pitch_deg: float = 0.0
    roll_deg: float = 0.0
    motion_rms: float = 0.0


class PPGPayload(BaseModel):
    """PPG-derived cardiovascular metrics."""

    hr_bpm: float = 0.0
    hrv_rmssd: float = 0.0
    ibi_ms: list[float] = Field(default_factory=list)
    sd1: float = 0.0
    sd2: float = 0.0
    ellipse_area: float = 0.0


class OpticalPayload(BaseModel):
    """Raw and derived optical data from Athena's frontal fNIRS array."""

    optical_raw: list[list[float]] = Field(default_factory=list)
    # Each inner list = one optode's time-series at 64 Hz.
    optical_sampling_rate_hz: float = 64.0
    optode_count: int = 0
    # Derived -- clearly labeled as experimental:
    prefrontal_oxy: float | None = None
    prefrontal_deoxy: float | None = None
    mental_effort_proxy: float | None = None
    signal_quality: float | None = None  # 0.0-1.0


class BreathingPayload(BaseModel):
    """Breathing rate estimates."""

    rr_bpm: float | None = None  # fused
    rr_ppg: float | None = None  # from IBI series
    rr_accel: float | None = None  # from accelerometer


class EA1Criterion(BaseModel):
    """Single EA-1 eligibility criterion."""

    value: float | None = None
    threshold: float | None = None
    units: str = ""
    met: bool = False


class EA1Result(BaseModel):
    """EA-1 multimodal eligibility result."""

    eligible: bool = False
    score: float = 0.0
    criteria_met: int = 0
    criteria_total: int = 5
    label: str = "Ineligible"
    gates: dict[str, bool] = Field(default_factory=dict)
    criteria: dict[str, Any] = Field(default_factory=dict)
    overlay_mode: str = "X0"
    alchemical_stage: str = ""
    s_space_coords: SSpaceCoords | None = None
    s_space_region: str = ""
    integration_coverage: float = 0.0


class ArtifactAnnotationPayload(BaseModel):
    """Single artifact annotation produced by Stage 3b ArtifactDetector."""

    artifact_type: str
    confidence: float
    channels: list[str]
    feature_value: float
    feature_name: str
    threshold: float


class ArtifactCorrectionPlanPayload(BaseModel):
    """Serialisable snapshot of the CorrectionPlan built by Stage 3b."""

    hard_reject: bool = False
    apply_ocular_regression: bool = False
    apply_asr: bool = False
    apply_notch: bool = False
    apply_cardiac_regression: bool = False


class StreamHealthPayload(BaseModel):
    """Real-time stream quality metrics, included in every SSE frame."""

    frames_total: int = 0
    frames_rejected: int = 0
    frames_clean: int = 0
    packet_loss_pct: float = 0.0
    last_frame_ts: float = 0.0
    avg_tick_ms: float = 0.0


class ModalityRatesPayload(BaseModel):
    """Sampling rates for each active sensor modality."""

    eeg_hz: float = 256.0
    optical_hz: float | None = None
    imu_hz: float | None = None


# ============================================================================
# Ingest / state payloads
# ============================================================================


class IngestPayload(BaseModel):
    """Internal payload passed from the pipeline to downstream consumers."""

    source: str = "athena"
    address: str = ""
    timestamp: float = Field(default_factory=time.time)
    bands: BandPowers = Field(default_factory=BandPowers)
    poor_contact: bool = False
    contact_quality: float | None = None
    faa: float | None = None
    fmt: float | None = None
    focus_score: float = 0.0
    fatigue_score: float = 0.0
    ppg: PPGPayload | None = None
    breathing: BreathingPayload | None = None
    imu: IMUPayload | None = None
    optical: OpticalPayload | None = None
    modality_rates: ModalityRatesPayload | None = None
    eeg_samples: list[list[float]] = Field(default_factory=list)
    bad_channels: list[str] = Field(default_factory=list)
    artifact_rejected: bool = False
    artifact_reasons: list[str] = Field(default_factory=list)
    artifact_annotations: list[ArtifactAnnotationPayload] = Field(default_factory=list)
    artifact_correction_plan: ArtifactCorrectionPlanPayload | None = None
    channel_impedances: dict[str, float] = Field(default_factory=dict)
    baseline_phase: str = "warmup"
    region: str = "A"
    alchemical_stage: str = "Nigredo"
    s_space: SSpaceCoords | None = None
    integration_coverage: float = 0.0
    engagement_index: float = 0.0
    stream_health: StreamHealthPayload | None = None


class NeurolinkState(BaseModel):
    """Complete EEG state snapshot broadcast to SSE consumers."""

    connected: bool = False
    source: str = ""
    region: str = "A"
    alchemical_stage: str = "Nigredo"
    integration_coverage: float = 0.0
    engagement_index: float = 0.0
    bands: BandPowers = Field(default_factory=BandPowers)
    s_space: SSpaceCoords | None = None
    ea1: EA1Result = Field(default_factory=EA1Result)
    last_ts: float = 0.0
    frame_count: int = 0
    poor_contact: bool = False
    region_v01: str = "A"
    alchemical_stage_v01: str = "Nigredo"
    faa: float | None = None
    fmt: float | None = None
    hr_bpm: float | None = None
    hrv_rmssd: float | None = None
    rr_bpm: float | None = None
    pitch_deg: float | None = None
    roll_deg: float | None = None
    motion_rms: float | None = None
    contact_quality: float | None = None
    focus_state: str = "unknown"
    focus_score: float = 0.0
    fatigue_score: float = 0.0
    optical: OpticalPayload | None = None
    modality_rates: ModalityRatesPayload | None = None
    eeg_samples: list[list[float]] = Field(default_factory=list)
    bad_channels: list[str] = Field(default_factory=list)
    artifact_rejected: bool = False
    artifact_reasons: list[str] = Field(default_factory=list)
    artifact_annotations: list[ArtifactAnnotationPayload] = Field(default_factory=list)
    artifact_correction_plan: ArtifactCorrectionPlanPayload | None = None
    channel_impedances: dict[str, float] = Field(default_factory=dict)
    baseline_phase: str = "warmup"
    stream_health: StreamHealthPayload | None = None

    @property
    def band_powers(self) -> BandPowers:
        return self.bands


# ============================================================================
# EEGSample -- frame contract consumed by the pipeline (ported from v1)
# ============================================================================


@dataclass
class EEGSample:
    """A single EEG sample snapshot from any adapter."""

    channels: list[float] = field(default_factory=lambda: [0.0] * 5)
    timestamp: float = field(default_factory=time.time)
    source: str = "athena"
    address: str = ""
    poor_contact: bool = False
    eeg_buffer: list[list[float]] | None = None
    ppg_buffer: list[float] | None = None
    accel_buffer: list[list[float]] | None = None
    gyro_buffer: list[list[float]] | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    optical_buffer: list[list[float]] | None = None
    optical_sampling_rate_hz: float | None = None
    eeg_aux_buffer: list[list[float]] | None = None
    modality_sampling_rates: dict[str, float] = field(default_factory=dict)
    transport_metadata: dict[str, str] = field(default_factory=dict)

    @property
    def eeg(self) -> list[float]:
        return self.channels
