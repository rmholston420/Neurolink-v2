"""FastAPI router: REST control for the stream + WebSocket endpoint."""

from fastapi import APIRouter, WebSocket
from fastapi.responses import JSONResponse

from .broadcaster import broadcaster
from neurolink_v2.domain.device.manager import device_manager
from neurolink_v2.domain.signal.dsp.models import StreamHealthPayload
from neurolink_v2.domain.signal.service import signal_service

router = APIRouter()


@router.get("/health", response_model=StreamHealthPayload)
async def stream_health() -> StreamHealthPayload:
    """Live stream-quality metrics from the DSP pipeline (StreamHealth)."""
    return signal_service.health_payload()


@router.post("/start")
async def start_stream():
    """Begin broadcasting EEG + optical + IMU frames to WebSocket clients.

    Returns 409 Conflict when no device is connected — starting a pump without a
    board is a client-state conflict, not a success.
    """
    if not device_manager.is_streaming:
        return JSONResponse(
            status_code=409,
            content={"error": "Device not connected. POST /api/device/connect first."},
        )
    await broadcaster.start_pump()
    return {"status": "streaming"}


@router.post("/stop")
async def stop_stream():
    """Halt the broadcast pump. Returns 409 Conflict when not currently streaming."""
    if not broadcaster.is_running:
        return JSONResponse(status_code=409, content={"error": "Not streaming"})
    await broadcaster.stop_pump()
    return {"status": "stopped"}


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """Live EEG / optical / IMU data feed.

    Connect from the frontend with:
        const ws = new WebSocket('ws://localhost:8000/api/stream/ws');
    """
    await broadcaster.subscribe(ws)
