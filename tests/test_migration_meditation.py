"""Verify the Alembic migration creates the meditation tables and can revert.

Runs the migration against a throwaway SQLite file using a sync engine. Since
root migration 0001 now creates the base ``sessions`` + ``eeg_samples`` store
as well, ``alembic upgrade head`` builds the whole schema on its own — no ORM
pre-seeding needed.
"""

from __future__ import annotations

from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

ROOT = Path(__file__).resolve().parents[1]


def _alembic_config(db_url: str) -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def test_migration_creates_and_drops_tables(tmp_path, monkeypatch):
    db_file = tmp_path / "mig.db"
    sync_url = f"sqlite:///{db_file}"

    # Point the app settings at the temp DB so env.py resolves the same URL.
    from neurolink_v2.domain.config import settings as settings_mod

    monkeypatch.setattr(
        settings_mod.settings, "database_url", f"sqlite+aiosqlite:///{db_file}"
    )

    engine = sa.create_engine(sync_url)

    cfg = _alembic_config(sync_url)
    command.upgrade(cfg, "head")

    insp = sa.inspect(engine)
    tables = set(insp.get_table_names())
    assert "sessions" in tables
    assert "session_frames" in tables
    assert "calibrations" in tables

    command.downgrade(cfg, "base")
    insp = sa.inspect(engine)
    tables = set(insp.get_table_names())
    assert "session_frames" not in tables
    assert "calibrations" not in tables
    engine.dispose()
