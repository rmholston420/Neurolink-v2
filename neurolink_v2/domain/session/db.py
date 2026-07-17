"""SQLAlchemy async database setup and session factory."""

import asyncio
import logging
from pathlib import Path

from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from neurolink_v2.domain.config.settings import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# alembic.ini lives at the repo root: <root>/neurolink_v2/domain/session/db.py
_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "alembic.ini"


class Base(DeclarativeBase):
    pass


def _run_migrations() -> str:
    """Apply Alembic migrations up to head; return the head revision label.

    Synchronous: Alembic drives its own sync engine via ``migrations/env.py``
    (which resolves the URL from ``settings.database_url``). ``script_location``
    is pinned to an absolute path so this works regardless of the CWD the app
    was launched from. Idempotent — a DB already at head is a no-op."""
    from alembic import command
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(_ALEMBIC_INI))
    cfg.set_main_option("script_location", str(_REPO_ROOT / "migrations"))
    command.upgrade(cfg, "head")
    return ScriptDirectory.from_config(cfg).get_current_head() or "base"


async def init_db() -> None:
    """Bring the schema to head via Alembic on startup.

    Alembic is the single source of truth for the schema: this replaces the
    former ``Base.metadata.create_all`` bootstrap, which created tables outside
    Alembic's version tracking and made a subsequent ``alembic upgrade head``
    fail with ``table ... already exists``."""
    from neurolink_v2.domain.session import models  # noqa: F401 – registers models

    try:
        head = await asyncio.to_thread(_run_migrations)
    except OperationalError as exc:
        if "already exists" in str(exc.orig):
            raise RuntimeError(
                "Schema tables already exist but Alembic has no version record "
                "(legacy install bootstrapped via create_all). Run "
                "`alembic stamp head` once to register the existing schema, then "
                f"restart the app. Original error: {exc.orig}"
            ) from exc
        raise
    # Alembic's env.py runs logging.fileConfig, which disables pre-existing
    # loggers and lowers the root level; re-enable ours so operators reliably
    # see the confirmation line.
    logger.disabled = False
    logger.setLevel(logging.INFO)
    logger.info("Applied Alembic migrations up to %s", head)
