"""Persistence helpers for meditation calibrations (async SQLAlchemy).

Backed by v2's existing session database (``calibrations`` table) — no parallel
store. Ported from MuseLink's ``db.save_calibration`` / ``get_latest_calibration``.
"""

from __future__ import annotations

from sqlalchemy import select

from neurolink_v2.domain.meditation.models import CalibrationRecord
from neurolink_v2.domain.session.db import AsyncSessionLocal
from neurolink_v2.domain.session.models import Calibration


async def save_calibration(record: CalibrationRecord) -> int:
    async with AsyncSessionLocal() as db:
        row = Calibration(
            created_at=record.created_at,
            label=record.label,
            alpha_base=record.alpha_base,
            theta_base=record.theta_base,
            beta_base=record.beta_base,
            delta_base=record.delta_base,
            gamma_base=record.gamma_base,
            faa_base=record.faa_base,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row.id


async def get_latest_calibration() -> CalibrationRecord | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Calibration).order_by(Calibration.id.desc()).limit(1)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return CalibrationRecord(
            id=row.id,
            created_at=row.created_at,
            label=row.label,
            alpha_base=row.alpha_base,
            theta_base=row.theta_base,
            beta_base=row.beta_base,
            delta_base=row.delta_base,
            gamma_base=row.gamma_base,
            faa_base=row.faa_base,
        )
