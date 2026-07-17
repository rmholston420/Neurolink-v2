"""Application entry point: creates the FastAPI app, mounts all routers, and
registers the BrainFlow session lifespan."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from neurolink_v2.domain.config.settings import settings
from neurolink_v2.domain.device.router import router as device_router
from neurolink_v2.domain.stream.router import router as stream_router
from neurolink_v2.domain.stream.recording_router import router as stream_recording_router
from neurolink_v2.domain.session.router import router as session_router
from neurolink_v2.domain.session.analysis_router import router as session_analysis_router
from neurolink_v2.domain.meditation.router import router as meditation_router
from neurolink_v2.domain.meditation.practice_tracker.router import router as practice_router
from neurolink_v2.domain.session.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB. Shutdown: nothing extra needed (device is
    stopped via the /device/disconnect endpoint)."""
    await init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Neurolink-v2",
        version="0.1.0",
        description="Real-time EEG + fNIRS streaming for the Muse Athena.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(device_router, prefix="/api/device", tags=["Device"])
    app.include_router(stream_router, prefix="/api/stream", tags=["Stream"])
    app.include_router(stream_recording_router, prefix="/api/stream", tags=["Stream Recording"])
    app.include_router(session_router, prefix="/api/sessions", tags=["Sessions"])
    app.include_router(session_analysis_router, prefix="/api/sessions", tags=["Session Analysis"])
    app.include_router(meditation_router, prefix="/api/meditation", tags=["Meditation"])
    app.include_router(practice_router, prefix="/api/practice", tags=["Practice Tracker"])

    return app


app = create_app()
