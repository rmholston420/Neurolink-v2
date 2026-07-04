"""REST endpoints for recording sessions."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import AsyncSessionLocal
from .models import Session as SessionModel

router = APIRouter()


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


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


@router.get("/{session_id}")
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(SessionModel, session_id)
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    return session
