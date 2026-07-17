"""FastAPI router: REST control for the stream + WebSocket endpoint."""

from fastapi import APIRouter, WebSocket
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .broadcaster import broadcaster
from .mode import VALID_SIGNAL_MODES, stream_mode
from neurolink_v2.domain.device.manager import device_manager
from neurolink_v2.domain.signal.dsp.models import StreamHealthPayload
from neurolink_v2.domain.signal.service import signal_service

router = APIRouter()


class SignalModeRequest(BaseModel):
    """Body for POST /mode: the requested signal-processing mode."""

    mode: str


@router.get("/health", response_model=StreamHealthPayload)
async def stream_health() -> StreamHealthPayload:
    """Live stream-quality metrics from the DSP pipeline (StreamHealth)."""
    return signal_service.health_payload()


@router.post("/mode")
async def set_signal_mode(req: SignalModeRequest):
    """Set the live signal-processing mode.

    Idempotent: posting the current mode is a no-op that still returns 200 with
    the active mode. Invalid modes return 400. State is in-memory and resets to
    ``meditation`` on backend restart.
    """
    try:
        current = stream_mode.set_mode(req.mode)
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Invalid mode '{req.mode}'. Must be one of {list(VALID_SIGNAL_MODES)}."
            },
        )
    return {"mode": current}


@router.get("/mode")
async def get_signal_mode():
    """Return the current signal-processing mode."""
    return {"mode": stream_mode.mode}


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
