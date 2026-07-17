"""FastAPI router for device lifecycle endpoints."""

import logging

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .manager import device_manager
from .preferences import get_last_paired, upsert_last_paired
from neurolink_v2.device_control.discovery import scan_for_muse_devices
from neurolink_v2.domain.config.settings import settings
from neurolink_v2.domain.stream.mode import stream_mode

log = logging.getLogger(__name__)

router = APIRouter()


class ConnectRequest(BaseModel):
    """Optional connect body. When omitted, the backend falls back to the
    last-paired device, then to the configured MUSE_MAC_ADDRESS."""

    ble_address: str | None = None
    display_name: str | None = None
    preset: str | None = None
    board_id: int | None = None


@router.get('/scan')
async def scan(timeout: float = Query(5.0, ge=1.0, le=30.0)):
    """Scan nearby BLE devices and return Muse candidates."""
    devices = await scan_for_muse_devices(timeout=timeout)
    return {
        'devices': [d.to_dict() for d in devices],
        'count': len(devices),
        'timeout': timeout,
    }


@router.post('/connect')
async def connect(req: ConnectRequest | None = Body(default=None)):
    """Connect to the Athena over BLE and persist it as the last-paired device.

    Idempotent: if a board is already connected and streaming this returns 200
    with the current status rather than 409, so a double-click never surfaces an
    error. Returns 400 when no address is supplied and none is persisted /
    configured, and 500 if the BrainFlow session fails to start.
    """
    req = req or ConnectRequest()

    if device_manager.has_board and device_manager.is_streaming:
        return await device_manager.connect(req.ble_address)

    try:
        last = await get_last_paired()
    except Exception:  # noqa: BLE001 — persistence is best-effort, never blocks connect
        log.debug('could not read last-paired device', exc_info=True)
        last = None
    address = req.ble_address or (last or {}).get('ble_address') or settings.muse_mac_address
    if not address:
        return JSONResponse(
            status_code=400,
            content={'error': 'No device address supplied and no last-paired device. '
                              'POST /api/device/scan then connect with a ble_address.'},
        )

    try:
        result = await device_manager.connect(address)
    except Exception as exc:  # noqa: BLE001 — surface real BrainFlow failures as 500
        log.exception('device_connect_failed address=%s', address)
        return JSONResponse(status_code=500, content={'error': str(exc)})

    try:
        await upsert_last_paired(
            ble_address=address,
            display_name=req.display_name or (last or {}).get('display_name') or 'Muse Athena',
            preset=req.preset or settings.muse_preset,
            board_id=req.board_id or device_manager.board_id,
        )
    except Exception:  # noqa: BLE001 — persistence is best-effort, never blocks connect
        log.warning('could not persist last-paired device', exc_info=True)
    return result


@router.post('/disconnect')
async def disconnect():
    """Stop streaming and release the BrainFlow session."""
    return await device_manager.disconnect()


@router.get('/last-paired')
async def last_paired():
    """Return the persisted last-paired device row (or null)."""
    return {'device': await get_last_paired()}


@router.get('/status')
async def status():
    """Return current device connection status."""
    return {
        'is_streaming': device_manager.is_streaming,
        'board_id': 'MUSE_S_ATHENA_BOARD',
        'has_board': device_manager.has_board,
        'channel_names': device_manager.channel_names,
        'preset': device_manager.preset,
        'transport_metadata': device_manager.transport_metadata,
        'signal_mode': stream_mode.mode,
    }
