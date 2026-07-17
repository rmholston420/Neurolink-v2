"""Signal-detail REST endpoints (Tier C sensor detail).

Exposes the live Stage-2 bad-channel state and a manual override toggle so the
frontend BadChannelPanel can flag / un-flag an electrode independently of the
automatic flat-line / noisy detectors. The manual flag takes priority in the
detector and is surfaced back in the WS frame's ``bad_channels`` payload.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from neurolink_v2.domain.signal.service import signal_service

router = APIRouter()


@router.get("/bad-channels")
async def get_bad_channels():
    """Return the current per-channel Stage-2 bad-channel snapshot."""
    stats = signal_service.bad_channel_stats()
    return {
        "channels": [
            {
                "name": s.name,
                "is_bad": s.is_bad,
                "reason": s.reason(),
                "flat_line": s.flat_line,
                "noisy": s.noisy,
                "manual_bad": s.manual_bad,
            }
            for s in stats
        ],
        "flagged": [s.name for s in stats if s.is_bad],
    }


class ManualBadRequest(BaseModel):
    channel: str
    bad: bool


@router.post("/bad-channels/manual")
async def set_manual_bad(body: ManualBadRequest):
    """Manually flag / un-flag a channel by name (e.g. 'AF7')."""
    try:
        signal_service.set_manual_bad(body.channel, body.bad)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await get_bad_channels()
