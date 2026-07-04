"""SQLAlchemy ORM models for recorded sessions."""

import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(255), default="")
    preset: Mapped[str] = mapped_column(String(32))
    started_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    csv_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    samples: Mapped[list["EEGSample"]] = relationship(
        "EEGSample", back_populates="session", lazy="dynamic"
    )


class EEGSample(Base):
    """Persisted EEG snapshot – stored at ~1 Hz for lightweight archival."""

    __tablename__ = "eeg_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    timestamp: Mapped[float] = mapped_column(Float, index=True)
    tp9: Mapped[float] = mapped_column(Float)
    af7: Mapped[float] = mapped_column(Float)
    af8: Mapped[float] = mapped_column(Float)
    tp10: Mapped[float] = mapped_column(Float)
    alpha_power: Mapped[float | None] = mapped_column(Float, nullable=True)
    theta_power: Mapped[float | None] = mapped_column(Float, nullable=True)

    session: Mapped[Session] = relationship("Session", back_populates="samples")
