"""API tests for Tier-C session endpoints: wandering-events + export.

Binds the session router's ``get_db`` to a throwaway temp SQLite DB and seeds a
session with a couple of frames so export has real rows to serialise.
"""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from neurolink_v2.domain.session import models as _models  # noqa: F401
from neurolink_v2.domain.session.db import Base
from neurolink_v2.domain.session.models import Session as SessionModel
from neurolink_v2.domain.session.models import SessionFrame
from neurolink_v2.domain.session.router import get_db
from neurolink_v2.main import create_app


def _client_and_engine(tmp_path):
    url = f"sqlite+aiosqlite:///{tmp_path / 'sessions.db'}"
    engine = create_async_engine(url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_db():
        async with SessionLocal() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)

    async def _mk():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_mk())
    return client, SessionLocal


def _seed_session(SessionLocal) -> int:
    async def _seed():
        async with SessionLocal() as db:
            s = SessionModel(label="Test", preset="athena", duration_s=120.0)
            db.add(s)
            await db.commit()
            await db.refresh(s)
            db.add_all(
                [
                    SessionFrame(session_id=s.id, ts=0.0, alpha=0.3, theta=0.2, region="H"),
                    SessionFrame(session_id=s.id, ts=1.0, alpha=0.4, theta=0.1, region="H"),
                ]
            )
            await db.commit()
            return s.id

    return asyncio.run(_seed())


def test_wandering_events_post_and_get(tmp_path):
    client, SessionLocal = _client_and_engine(tmp_path)
    sid = _seed_session(SessionLocal)
    r = client.post(
        f"/api/sessions/{sid}/wandering-events",
        json={"ts": 12.5, "tag": "planning", "note": "grocery list"},
    )
    assert r.status_code == 200
    assert r.json()["tag"] == "planning"

    r = client.get(f"/api/sessions/{sid}/wandering-events")
    assert r.status_code == 200
    events = r.json()["events"]
    assert len(events) == 1
    assert events[0]["note"] == "grocery list"


def test_export_json(tmp_path):
    client, SessionLocal = _client_and_engine(tmp_path)
    sid = _seed_session(SessionLocal)
    r = client.get(f"/api/sessions/{sid}/export?format=json")
    assert r.status_code == 200
    body = r.json()
    assert body["session"]["id"] == sid
    assert len(body["frames"]) == 2
    assert body["frames"][0]["region"] == "H"


def test_export_csv(tmp_path):
    client, SessionLocal = _client_and_engine(tmp_path)
    sid = _seed_session(SessionLocal)
    r = client.get(f"/api/sessions/{sid}/export?format=csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("ts,alpha,theta")
    assert len(lines) == 3  # header + 2 frames


def test_export_bad_format(tmp_path):
    client, SessionLocal = _client_and_engine(tmp_path)
    sid = _seed_session(SessionLocal)
    r = client.get(f"/api/sessions/{sid}/export?format=xml")
    assert r.status_code == 400


def test_export_missing_session_404(tmp_path):
    client, _ = _client_and_engine(tmp_path)
    r = client.get("/api/sessions/999/export?format=json")
    assert r.status_code == 404


def test_summary_aggregates(tmp_path):
    client, SessionLocal = _client_and_engine(tmp_path)
    sid = _seed_session(SessionLocal)

    async def _add_stage_frames():
        async with SessionLocal() as db:
            db.add_all(
                [
                    SessionFrame(session_id=sid, ts=2.0, region="H", stage="Rubedo", ea1_eligible=1),
                    SessionFrame(session_id=sid, ts=2.4, region="H", stage="Rubedo", ea1_eligible=1),
                    SessionFrame(session_id=sid, ts=3.0, region="H", stage="Rubedo", ea1_eligible=1),
                    SessionFrame(session_id=sid, ts=4.0, region="H", stage="Albedo", ea1_eligible=0),
                ]
            )
            await db.commit()

    asyncio.run(_add_stage_frames())

    r = client.get(f"/api/sessions/{sid}/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == sid
    assert body["frame_count"] == 6  # 2 seed + 4 added
    # eligible frames at ts 2.0, 2.4, 3.0 -> distinct integer seconds {2, 3}
    assert body["ea1_eligible_seconds"] == 2
    assert body["dominant_stage"] == "Rubedo"
    assert body["notes_count"] == 0
    assert body["wandering_count"] == 0


def test_summary_missing_session_404(tmp_path):
    client, _ = _client_and_engine(tmp_path)
    r = client.get("/api/sessions/999/summary")
    assert r.status_code == 404
