"""REST endpoints for Tier-B session goals + journal notes.

Backs the ``SessionGoals`` and ``AlchemicalJournal`` UI components with real
persistence in the existing session database (``session_goals`` /
``journal_notes`` tables from migration 0002). Goals and notes are optionally
scoped to a ``sessions.id``; when ``session_id`` is omitted they are standing
records not tied to a recorded session.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import AsyncSessionLocal
from .models import JournalNote, SessionGoal

router = APIRouter()


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


def _now() -> str:
    return datetime.now(UTC).isoformat()


# ---- Goals --------------------------------------------------------------
class GoalCreate(BaseModel):
    text: str
    metric: str | None = None
    target: float | None = None
    session_id: int | None = None


class GoalUpdate(BaseModel):
    progress: float | None = None
    achieved: bool | None = None
    text: str | None = None


def _goal_dict(g: SessionGoal) -> dict:
    return {
        "id": g.id,
        "session_id": g.session_id,
        "text": g.text,
        "metric": g.metric,
        "target": g.target,
        "progress": g.progress,
        "achieved": bool(g.achieved),
        "created_at": g.created_at,
    }


@router.get("/goals")
async def list_goals(session_id: int | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(SessionGoal).order_by(SessionGoal.id.desc())
    if session_id is not None:
        stmt = stmt.where(SessionGoal.session_id == session_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {"goals": [_goal_dict(g) for g in rows]}


@router.post("/goals")
async def create_goal(body: GoalCreate, db: AsyncSession = Depends(get_db)):
    goal = SessionGoal(
        text=body.text, metric=body.metric, target=body.target,
        session_id=body.session_id, progress=0.0, achieved=0, created_at=_now(),
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return _goal_dict(goal)


@router.patch("/goals/{goal_id}")
async def update_goal(goal_id: int, body: GoalUpdate, db: AsyncSession = Depends(get_db)):
    goal = await db.get(SessionGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if body.progress is not None:
        goal.progress = max(0.0, min(1.0, body.progress))
    if body.achieved is not None:
        goal.achieved = 1 if body.achieved else 0
    if body.text is not None:
        goal.text = body.text
    await db.commit()
    await db.refresh(goal)
    return _goal_dict(goal)


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: int, db: AsyncSession = Depends(get_db)):
    goal = await db.get(SessionGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.delete(goal)
    await db.commit()
    return {"status": "deleted", "id": goal_id}


# ---- Notes --------------------------------------------------------------
class NoteCreate(BaseModel):
    text: str
    stage: str | None = None
    region: str | None = None
    session_id: int | None = None


def _note_dict(n: JournalNote) -> dict:
    return {
        "id": n.id,
        "session_id": n.session_id,
        "text": n.text,
        "stage": n.stage,
        "region": n.region,
        "created_at": n.created_at,
    }


@router.get("/notes")
async def list_notes(session_id: int | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(JournalNote).order_by(JournalNote.id.desc())
    if session_id is not None:
        stmt = stmt.where(JournalNote.session_id == session_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {"notes": [_note_dict(n) for n in rows]}


@router.post("/notes")
async def create_note(body: NoteCreate, db: AsyncSession = Depends(get_db)):
    note = JournalNote(
        text=body.text, stage=body.stage, region=body.region,
        session_id=body.session_id, created_at=_now(),
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _note_dict(note)
