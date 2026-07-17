"""Practice tracker REST endpoints (ported from MuseLink)."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from neurolink_v2.domain.meditation.practice_tracker.adaptive_engine import (
    recommend_duration,
    recommend_technique,
)
from neurolink_v2.domain.meditation.practice_tracker.lci_service import lci_service

router = APIRouter()


class LCIEntry(BaseModel):
    value: float


@router.post("/lci")
async def post_lci(entry: LCIEntry):
    lci_service.record(entry.value)
    return {"status": "recorded"}


@router.get("/lci/history")
async def lci_history(n: int = 50):
    return {"history": lci_service.history(n), "mean": lci_service.mean(n)}


@router.get("/recommend")
async def recommend():
    m = lci_service.mean()
    h = lci_service.history()
    return {
        "technique": recommend_technique(m),
        "duration_minutes": recommend_duration(m, len(h)),
        "mean_lci": round(m, 4),
    }
