from __future__ import annotations

from fastapi import APIRouter

from neurolink_v2.domain.stream import recorder

router = APIRouter()


@router.get("/recording")
async def get_recording_status():
    return {
        "recording": recorder.is_recording(),
        "path": recorder.current_path(),
    }


@router.post("/recording/start")
async def start_recording():
    path = recorder.start_recording()
    return {
        "status": "started",
        "recording": True,
        "path": path,
    }


@router.post("/recording/stop")
async def stop_recording():
    recorder.stop_recording()
    return {
        "status": "stopped",
        "recording": False,
        "path": "",
    }
