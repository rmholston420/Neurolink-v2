"""Migration + persistence tests for device_preferences (PR #11, Fix 2).

Verifies migration 0004 creates and drops the table (reversible), and that the
preferences helper round-trips a last-paired device row against a throwaway
SQLite DB.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

ROOT = Path(__file__).resolve().parents[1]


def _alembic_config(db_url: str) -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def test_migration_0004_creates_and_drops_table(tmp_path, monkeypatch):
    db_file = tmp_path / "pref.db"
    sync_url = f"sqlite:///{db_file}"

    from neurolink_v2.domain.config import settings as settings_mod

    monkeypatch.setattr(
        settings_mod.settings, "database_url", f"sqlite+aiosqlite:///{db_file}"
    )

    engine = sa.create_engine(sync_url)
    cfg = _alembic_config(sync_url)

    command.upgrade(cfg, "head")
    assert "device_preferences" in set(sa.inspect(engine).get_table_names())

    # Reversible: downgrade one step removes exactly this table.
    command.downgrade(cfg, "0003_wandering_events")
    tables = set(sa.inspect(engine).get_table_names())
    assert "device_preferences" not in tables
    assert "wandering_events" in tables
    engine.dispose()


@pytest.mark.asyncio
async def test_upsert_and_get_last_paired_roundtrip(tmp_path, monkeypatch):
    db_file = tmp_path / "pref_rt.db"
    sync_url = f"sqlite:///{db_file}"

    # env.py resolves the migration URL from settings.database_url, so point it
    # at the temp file for the upgrade.
    from neurolink_v2.domain.config import settings as settings_mod

    monkeypatch.setattr(
        settings_mod.settings, "database_url", f"sqlite+aiosqlite:///{db_file}"
    )

    cfg = _alembic_config(sync_url)
    command.upgrade(cfg, "head")

    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    from neurolink_v2.domain.device import preferences as prefs_mod

    monkeypatch.setattr(prefs_mod, "AsyncSessionLocal", session_factory)

    assert await prefs_mod.get_last_paired() is None

    await prefs_mod.upsert_last_paired(
        ble_address="00:55:DA:BA:23:4A",
        display_name="Athena-234A",
        preset="p1041",
        board_id=67,
    )
    row = await prefs_mod.get_last_paired()
    assert row["ble_address"] == "00:55:DA:BA:23:4A"
    assert row["board_id"] == 67
    assert row["connected_at"] is not None

    # Upsert updates the single sentinel row in place (no duplicate rows).
    await prefs_mod.upsert_last_paired(
        ble_address="00:55:DA:BA:99:99",
        display_name="Athena-9999",
        preset="p1042",
        board_id=67,
    )
    row2 = await prefs_mod.get_last_paired()
    assert row2["ble_address"] == "00:55:DA:BA:99:99"

    async with session_factory() as s:
        from neurolink_v2.domain.session.models import DevicePreference

        count = (await s.execute(sa.select(sa.func.count(DevicePreference.id)))).scalar_one()
    assert count == 1
    await engine.dispose()
