"""SQLAlchemy async database setup and session factory."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from neurolink_v2.domain.config.settings import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables on startup."""
    from neurolink_v2.domain.session import models  # noqa: F401 – registers models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
