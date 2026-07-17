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


class SessionFrame(Base):
    """Meditation-domain per-frame metrics (ported from MuseLink session_frames).

    Extends v2's existing sessions store rather than living in a parallel DB:
    each row references ``sessions.id`` and captures the classifier / EA-1
    outputs alongside band powers for longitudinal review.
    """

    __tablename__ = "session_frames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), index=True)
    ts: Mapped[float] = mapped_column(Float, index=True)
    alpha: Mapped[float] = mapped_column(Float, default=0.0)
    theta: Mapped[float] = mapped_column(Float, default=0.0)
    beta: Mapped[float] = mapped_column(Float, default=0.0)
    delta: Mapped[float] = mapped_column(Float, default=0.0)
    gamma: Mapped[float] = mapped_column(Float, default=0.0)
    faa: Mapped[float | None] = mapped_column(Float, nullable=True)
    fmt: Mapped[float | None] = mapped_column(Float, nullable=True)
    region: Mapped[str | None] = mapped_column(String(4), nullable=True)
    stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ea1_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ea1_eligible: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hrv_rmssd: Mapped[float | None] = mapped_column(Float, nullable=True)
    rr_bpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    motion_rms: Mapped[float | None] = mapped_column(Float, nullable=True)


class SessionGoal(Base):
    """User-defined intention for a practice session (Tier-B SessionGoals).

    Optionally scoped to a ``sessions.id`` (``session_id`` NULL = a standing
    goal not tied to a recorded session). ``progress`` is a client-updated
    0..1 completion estimate; ``achieved`` latches when the goal is met.
    """

    __tablename__ = "session_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id"), nullable=True, index=True
    )
    text: Mapped[str] = mapped_column(String(500), default="")
    metric: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target: Mapped[float | None] = mapped_column(Float, nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    achieved: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(64), default="")


class JournalNote(Base):
    """Free-text note captured during a session (Tier-B AlchemicalJournal).

    Records the alchemical stage / s-space region at the moment of writing so
    the Journal timeline can correlate reflections with the practice arc.
    """

    __tablename__ = "journal_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id"), nullable=True, index=True
    )
    text: Mapped[str] = mapped_column(String(2000), default="")
    stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    region: Mapped[str | None] = mapped_column(String(4), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")


class WanderingEvent(Base):
    """A mind-wandering episode tagged during a practice session.

    Persists the real-time WanderingLog tags (Tier C): each row records when
    attention drifted (``ts``, monotonic session seconds), the user-assigned
    ``tag`` (planning / memory / body / emotion / drowsy), and an optional note.
    """

    __tablename__ = "wandering_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id"), nullable=True, index=True
    )
    ts: Mapped[float] = mapped_column(Float, default=0.0)
    tag: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    intensity: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")


class DevicePreference(Base):
    """Last-paired device, persisted so the backend can auto-reconnect on boot.

    A single sentinel row (``key == 'last_paired_device'``) records the most
    recently connected headset so a fresh uvicorn process can attempt one
    background reconnect without the user re-issuing a Scan+Connect from the UI.
    """

    __tablename__ = "device_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    ble_address: Mapped[str] = mapped_column(String(128), default="")
    display_name: Mapped[str] = mapped_column(String(128), default="")
    preset: Mapped[str] = mapped_column(String(32), default="")
    board_id: Mapped[int] = mapped_column(Integer, default=0)
    connected_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Calibration(Base):
    """Per-band resting baseline (ported from MuseLink calibrations)."""

    __tablename__ = "calibrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")
    label: Mapped[str] = mapped_column(String(255), default="Baseline")
    alpha_base: Mapped[float] = mapped_column(Float, default=1.0)
    theta_base: Mapped[float] = mapped_column(Float, default=1.0)
    beta_base: Mapped[float] = mapped_column(Float, default=1.0)
    delta_base: Mapped[float] = mapped_column(Float, default=1.0)
    gamma_base: Mapped[float] = mapped_column(Float, default=1.0)
    faa_base: Mapped[float] = mapped_column(Float, default=0.0)
