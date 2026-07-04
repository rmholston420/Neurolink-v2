from __future__ import annotations

import asyncio
from dataclasses import dataclass, asdict
from typing import Any

try:
    from bleak import BleakScanner
except Exception:
    BleakScanner = None


@dataclass(slots=True)
class MuseCandidate:
    name: str
    address: str
    rssi: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


async def scan_for_muse_devices(timeout: float = 5.0) -> list[MuseCandidate]:
    if BleakScanner is None:
        return []
    found = await BleakScanner.discover(timeout=timeout)
    devices: list[MuseCandidate] = []
    for d in found:
        name = getattr(d, 'name', None)
        if name and 'Muse' in name:
            devices.append(MuseCandidate(name=name, address=d.address, rssi=getattr(d, 'rssi', None)))
    return devices


def scan_for_muse_devices_sync(timeout: float = 5.0) -> list[MuseCandidate]:
    return asyncio.run(scan_for_muse_devices(timeout=timeout))
