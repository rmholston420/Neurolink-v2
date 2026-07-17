"""REST endpoints for recording sessions."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import AsyncSessionLocal
from .models import JournalNote, SessionFrame
from .models import Session as SessionModel
from .models import WanderingEvent

router = APIRouter()


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


def _now() -> str:
    return datetime.now(UTC).isoformat()


@router.get("/")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SessionModel).order_by(SessionModel.started_at.desc()))
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "label": s.label,
            "preset": s.preset,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "duration_s": s.duration_s,
        }
        for s in sessions
    ]


# ---- Wandering events ---------------------------------------------------
class WanderingEventCreate(BaseModel):
    ts: float = 0.0
    tag: str | None = None
    note: str | None = None
    intensity: float | None = None


def _wandering_dict(e: WanderingEvent) -> dict:
    return {
        "id": e.id,
        "session_id": e.session_id,
        "ts": e.ts,
        "tag": e.tag,
        "note": e.note,
        "intensity": e.intensity,
        "created_at": e.created_at,
    }


@router.get("/{session_id}/wandering-events")
async def list_wandering_events(session_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(WanderingEvent)
        .where(WanderingEvent.session_id == session_id)
        .order_by(WanderingEvent.ts.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {"events": [_wandering_dict(e) for e in rows]}


@router.post("/{session_id}/wandering-events")
async def create_wandering_event(
    session_id: int, body: WanderingEventCreate, db: AsyncSession = Depends(get_db)
):
    event = WanderingEvent(
        session_id=session_id,
        ts=body.ts,
        tag=body.tag,
        note=body.note,
        intensity=body.intensity,
        created_at=_now(),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _wandering_dict(event)


@router.post("/wandering-events")
async def create_unattached_wandering_event(
    body: WanderingEventCreate, db: AsyncSession = Depends(get_db)
):
    """Persist a wandering event not tied to a recorded session.

    The live Practice shell tags mind-wandering in real time without a DB
    session row (recordings are JSONL files), so these events are stored with a
    null ``session_id`` — the nullable FK the wandering_events table was created
    with.
    """
    event = WanderingEvent(
        session_id=None,
        ts=body.ts,
        tag=body.tag,
        note=body.note,
        intensity=body.intensity,
        created_at=_now(),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _wandering_dict(event)


# ---- Export -------------------------------------------------------------
_FRAME_COLUMNS = [
    "ts", "alpha", "theta", "beta", "delta", "gamma", "faa", "fmt",
    "region", "stage", "ea1_score", "ea1_eligible", "hrv_rmssd", "rr_bpm", "motion_rms",
]


def _frame_row(f: SessionFrame) -> dict:
    return {col: getattr(f, col) for col in _FRAME_COLUMNS}


@router.get("/{session_id}/export")
async def export_session(
    session_id: int, format: str = "json", db: AsyncSession = Depends(get_db)
):
    """Export one session's per-frame timeline as CSV or JSON.

    ``format=csv`` streams the ``session_frames`` rows; ``format=json`` returns
    session metadata plus frames, wandering events, and journal notes.
    """
    fmt = format.lower()
    if fmt not in {"csv", "json"}:
        raise HTTPException(status_code=400, detail="format must be 'csv' or 'json'")

    session = await db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    frames = (
        (
            await db.execute(
                select(SessionFrame)
                .where(SessionFrame.session_id == session_id)
                .order_by(SessionFrame.ts.asc())
            )
        )
        .scalars()
        .all()
    )

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=_FRAME_COLUMNS)
        writer.writeheader()
        for f in frames:
            writer.writerow(_frame_row(f))
        buf.seek(0)
        filename = f"session-{session_id}-frames.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    wandering = (
        (
            await db.execute(
                select(WanderingEvent)
                .where(WanderingEvent.session_id == session_id)
                .order_by(WanderingEvent.ts.asc())
            )
        )
        .scalars()
        .all()
    )
    notes = (
        (
            await db.execute(
                select(JournalNote)
                .where(JournalNote.session_id == session_id)
                .order_by(JournalNote.id.asc())
            )
        )
        .scalars()
        .all()
    )
    return {
        "session": {
            "id": session.id,
            "label": session.label,
            "preset": session.preset,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "duration_s": session.duration_s,
        },
        "frames": [_frame_row(f) for f in frames],
        "wandering_events": [_wandering_dict(e) for e in wandering],
        "notes": [
            {"id": n.id, "text": n.text, "stage": n.stage, "region": n.region,
             "created_at": n.created_at}
            for n in notes
        ],
    }


@router.get("/{session_id}/summary")
async def session_summary(session_id: int, db: AsyncSession = Depends(get_db)):
    """Cheap per-session aggregates for the Journal history rows.

    Computes frame count, EA-1-eligible seconds (distinct integer ``ts``
    seconds carrying an eligible frame), the dominant alchemical stage (the
    stage tagged on the most frames), and note / wandering counts — all via
    aggregate queries so the history list never has to fetch full frame data.
    Fields that can't be computed (no frames, no tagged stage) are omitted.
    """
    session = await db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    frame_count = (
        await db.execute(
            select(func.count()).select_from(SessionFrame).where(
                SessionFrame.session_id == session_id
            )
        )
    ).scalar_one()

    eligible_seconds = (
        await db.execute(
            select(func.count(func.distinct(func.cast(SessionFrame.ts, Integer)))).where(
                SessionFrame.session_id == session_id,
                SessionFrame.ea1_eligible == 1,
            )
        )
    ).scalar_one()

    dominant = (
        await db.execute(
            select(SessionFrame.stage, func.count().label("n"))
            .where(SessionFrame.session_id == session_id, SessionFrame.stage.is_not(None))
            .group_by(SessionFrame.stage)
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()

    notes_count = (
        await db.execute(
            select(func.count()).select_from(JournalNote).where(
                JournalNote.session_id == session_id
            )
        )
    ).scalar_one()

    wandering_count = (
        await db.execute(
            select(func.count()).select_from(WanderingEvent).where(
                WanderingEvent.session_id == session_id
            )
        )
    ).scalar_one()

    out: dict = {
        "id": session.id,
        "label": session.label,
        "preset": session.preset,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "duration_s": session.duration_s,
        "frame_count": frame_count,
        "notes_count": notes_count,
        "wandering_count": wandering_count,
    }
    if frame_count:
        out["ea1_eligible_seconds"] = eligible_seconds
    if dominant is not None:
        out["dominant_stage"] = dominant[0]
    return out


@router.get("/{session_id}")
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
