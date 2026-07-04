"""FastAPI router for device lifecycle endpoints."""

from fastapi import APIRouter, Query

from .manager import device_manager
from neurolink_v2.device_control.discovery import scan_for_muse_devices

router = APIRouter()


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
async def connect():
    """Discover and connect to the Muse S Athena over BLE."""
    return await device_manager.connect()


@router.post('/disconnect')
async def disconnect():
    """Stop streaming and release the BrainFlow session."""
    return await device_manager.disconnect()


@router.get('/status')
async def status():
    """Return current device connection status."""
    return {
        'is_streaming': device_manager.is_streaming,
        'board_id': 'MUSE_S_ATHENA_BOARD',
        'has_board': device_manager.has_board,
        'channel_names': device_manager.channel_names,
        'preset': device_manager.preset,
    }
