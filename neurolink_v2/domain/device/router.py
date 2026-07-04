"""FastAPI router for device lifecycle endpoints."""

from fastapi import APIRouter

from .manager import device_manager

router = APIRouter()


@router.post("/connect")
async def connect():
    """Discover and connect to the Muse S Athena over BLE."""
    return await device_manager.connect()


@router.post("/disconnect")
async def disconnect():
    """Stop streaming and release the BrainFlow session."""
    return await device_manager.disconnect()


@router.get("/status")
async def status():
    """Return current device connection status."""
    return {
        "is_streaming": device_manager.is_streaming,
        "board_id": "MUSE_S_ATHENA_BOARD",
    }
