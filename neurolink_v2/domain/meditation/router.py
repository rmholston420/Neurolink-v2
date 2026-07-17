"""Meditation REST endpoints: EA-1 scoring, s-space classification, calibration.

Ported/merged from MuseLink's ``calibration_router`` plus a new stateless
``/classify`` endpoint that runs the ported classifier + EA-1 scorer on an
:class:`IngestPayload`.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from neurolink_v2.domain.meditation import classifier
from neurolink_v2.domain.meditation.calibration_service import (
    get_latest_calibration,
    save_calibration,
)
from neurolink_v2.domain.meditation.ea1_scorer import score_ea1
from neurolink_v2.domain.meditation.models import (
    CalibrationRecord,
    EA1Result,
    IngestPayload,
    MeditationFrame,
)
from neurolink_v2.domain.signal.stage0.live import live_stage0

router = APIRouter()


@router.post("/classify", response_model=MeditationFrame)
async def classify_frame(payload: IngestPayload) -> MeditationFrame:
    """Classify one ingest frame into region/stage/overlay + EA-1 result."""
    derived = classifier.classify(payload)
    ea1: EA1Result = score_ea1(
        region=derived["region"],
        imu=payload.imu,
        ppg=payload.ppg,
        faa=payload.faa,
        fmt=payload.fmt,
    )
    return MeditationFrame(
        ts=payload.ts,
        alpha=payload.alpha,
        theta=payload.theta,
        beta=payload.beta,
        delta=payload.delta,
        gamma=payload.gamma,
        faa=payload.faa,
        fmt=payload.fmt,
        region=derived["region"],
        alchemical_stage=derived["alchemical_stage"],
        overlay_mode=derived["overlay_mode"],
        integration_coverage=derived["integration_coverage"],
        engagement_index=derived["engagement_index"],
        ea1_result=ea1,
        hrv=payload.ppg,
        imu=payload.imu,
    )


class CalibrationRequest(BaseModel):
    label: str = "Baseline"
    duration_s: int = 120


@router.post("/calibration/start")
async def start_calibration(body: CalibrationRequest):
    return {"status": "started", "label": body.label, "duration_s": body.duration_s}


class CalibrationSaveRequest(BaseModel):
    label: str = "Baseline"
    alpha_base: float = 1.0
    theta_base: float = 1.0
    beta_base: float = 1.0
    delta_base: float = 1.0
    gamma_base: float = 1.0
    faa_base: float = 0.0


@router.post("/calibration/save")
async def save_calibration_endpoint(body: CalibrationSaveRequest):
    cal = CalibrationRecord(
        created_at=datetime.now(UTC).isoformat(),
        label=body.label,
        alpha_base=body.alpha_base,
        theta_base=body.theta_base,
        beta_base=body.beta_base,
        delta_base=body.delta_base,
        gamma_base=body.gamma_base,
        faa_base=body.faa_base,
    )
    cal_id = await save_calibration(cal)
    return {"status": "saved", "id": cal_id}


@router.get("/calibration/latest")
async def get_calibration():
    cal = await get_latest_calibration()
    return cal or {}


@router.get("/stage0-readiness")
async def get_stage0_readiness():
    """Live Stage-0 pre-flight status (impedance / IMU / environment).

    Consumed by the CalibrationPanel pre-flight to decide whether the resting
    baseline may begin. Impedance reflects real per-channel estimates fed by
    the EEG pump; environment steps are acknowledged via the endpoint below.
    """
    return live_stage0.status_dict()


class Stage0AckRequest(BaseModel):
    step_id: str | None = None
    all: bool = False


@router.post("/stage0-readiness/ack")
async def ack_stage0_step(body: Stage0AckRequest):
    """Acknowledge one (or all) environment checklist step(s)."""
    if body.all:
        live_stage0.acknowledge_all()
        return live_stage0.status_dict()
    if body.step_id and live_stage0.acknowledge(body.step_id):
        return live_stage0.status_dict()
    return {"status": "error", "detail": "unknown or missing step_id"}
