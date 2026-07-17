"""API tests for Tier-B session goals + journal notes endpoints.

Uses FastAPI ``dependency_overrides`` to bind the router's ``get_db`` to a
throwaway temp SQLite database, so the tests never touch the repo DB.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from neurolink_v2.domain.session import models as _models  # noqa: F401 – registers tables
from neurolink_v2.domain.session.journal_router import get_db
from neurolink_v2.main import create_app

from .conftest import apply_migrations


def _client(tmp_path):
    db_file = tmp_path / "journal.db"
    apply_migrations(db_file)
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_db():
        async with SessionLocal() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    return client


def test_goals_crud(tmp_path):
    client = _client(tmp_path)
    r = client.post(
        "/api/journal/goals",
        json={"text": "Reach EA1 for 5 min", "metric": "ea1_seconds", "target": 300},
    )
    assert r.status_code == 200
    goal = r.json()
    assert goal["text"] == "Reach EA1 for 5 min"
    assert goal["achieved"] is False
    gid = goal["id"]

    r = client.patch(f"/api/journal/goals/{gid}", json={"progress": 1.2, "achieved": True})
    assert r.status_code == 200
    updated = r.json()
    assert updated["progress"] == 1.0  # clamped to [0, 1]
    assert updated["achieved"] is True

    r = client.get("/api/journal/goals")
    assert any(g["id"] == gid for g in r.json()["goals"])

    r = client.delete(f"/api/journal/goals/{gid}")
    assert r.status_code == 200
    r = client.get("/api/journal/goals")
    assert all(g["id"] != gid for g in r.json()["goals"])


def test_notes_create_and_list(tmp_path):
    client = _client(tmp_path)
    r = client.post(
        "/api/journal/notes",
        json={"text": "settled quickly", "stage": "Albedo", "region": "C"},
    )
    assert r.status_code == 200
    assert r.json()["stage"] == "Albedo"
    r = client.get("/api/journal/notes")
    assert len(r.json()["notes"]) == 1
