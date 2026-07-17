"""Verify the Alembic migration creates the meditation tables and can revert.

Runs the migration against a throwaway SQLite file using a sync engine. The
``sessions`` table (referenced by ``session_frames.session_id``) is created
first via the ORM metadata, mirroring the app bootstrap where ``init_db()``
create_all precedes migration-managed extensions.
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

    # Pre-create the base sessions table the FK depends on.
    from neurolink_v2.domain.session.db import Base
    from neurolink_v2.domain.session import models as _m  # noqa: F401

    Base.metadata.tables["sessions"].create(engine)

    cfg = _alembic_config(sync_url)
    command.upgrade(cfg, "head")

    insp = sa.inspect(engine)
    tables = set(insp.get_table_names())
    assert "session_frames" in tables
    assert "calibrations" in tables

    command.downgrade(cfg, "base")
    insp = sa.inspect(engine)
    tables = set(insp.get_table_names())
    assert "session_frames" not in tables
    assert "calibrations" not in tables
    engine.dispose()
