"""Shared test helpers for the sessions/meditation suite.

``apply_migrations`` brings a throwaway SQLite file to the Alembic head, mirroring
the app bootstrap now that ``init_db`` runs migrations instead of
``Base.metadata.create_all``. Tests that previously created tables via the ORM
metadata should use this so their schema matches production exactly.
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

ROOT = Path(__file__).resolve().parents[1]


def apply_migrations(db_file) -> None:
    """Create the full schema on ``db_file`` by running Alembic to head.

    Alembic's ``env.py`` resolves the URL from ``settings.database_url``, so we
    point it at the temp file for the duration of the upgrade and restore it
    afterwards to avoid leaking state across tests."""
    from neurolink_v2.domain.config import settings as settings_mod

    prev = settings_mod.settings.database_url
    settings_mod.settings.database_url = f"sqlite+aiosqlite:///{db_file}"
    try:
        cfg = Config(str(ROOT / "alembic.ini"))
        cfg.set_main_option("script_location", str(ROOT / "migrations"))
        command.upgrade(cfg, "head")
    finally:
        settings_mod.settings.database_url = prev
