"""Persistence helpers for the last-paired device (auto-reconnect support).

A single sentinel row (``LAST_PAIRED_KEY``) in ``device_preferences`` records
the most recently connected headset. ``upsert_last_paired`` is called after a
successful connect; ``get_last_paired`` is read on startup (for the background
auto-reconnect) and by ``GET /api/device/last-paired`` for the UI.
"""

from __future__ import annotations

import datetime

from sqlalchemy import select

from neurolink_v2.domain.session.db import AsyncSessionLocal
from neurolink_v2.domain.session.models import DevicePreference

LAST_PAIRED_KEY = "last_paired_device"


def _serialize(pref: DevicePreference) -> dict:
    return {
        "ble_address": pref.ble_address,
        "display_name": pref.display_name,
        "preset": pref.preset,
        "board_id": pref.board_id,
        "connected_at": pref.connected_at.isoformat() if pref.connected_at else None,
    }


async def get_last_paired() -> dict | None:
    """Return the persisted last-paired device row, or ``None`` if unset."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DevicePreference).where(DevicePreference.key == LAST_PAIRED_KEY)
        )
        pref = result.scalar_one_or_none()
        return _serialize(pref) if pref else None


async def upsert_last_paired(
    *,
    ble_address: str,
    display_name: str,
    preset: str,
    board_id: int,
) -> dict:
    """Insert or update the single last-paired device sentinel row."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DevicePreference).where(DevicePreference.key == LAST_PAIRED_KEY)
        )
        pref = result.scalar_one_or_none()
        now = datetime.datetime.now(datetime.timezone.utc)
        if pref is None:
            pref = DevicePreference(key=LAST_PAIRED_KEY)
            session.add(pref)
        pref.ble_address = ble_address
        pref.display_name = display_name
        pref.preset = preset
        pref.board_id = board_id
        pref.connected_at = now
        await session.commit()
        await session.refresh(pref)
        return _serialize(pref)
