"""Application entry point: creates the FastAPI app, mounts all routers, and
registers the BrainFlow session lifespan."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from neurolink_v2.domain.config.settings import settings
from neurolink_v2.domain.device.router import router as device_router
from neurolink_v2.domain.stream.router import router as stream_router
from neurolink_v2.domain.stream.recording_router import router as stream_recording_router
from neurolink_v2.domain.session.router import router as session_router
from neurolink_v2.domain.session.analysis_router import router as session_analysis_router
from neurolink_v2.domain.session.journal_router import router as journal_router
from neurolink_v2.domain.meditation.router import router as meditation_router
from neurolink_v2.domain.meditation.practice_tracker.router import router as practice_router
from neurolink_v2.domain.signal.router import router as signal_router
from neurolink_v2.domain.session.db import init_db

log = logging.getLogger(__name__)

# Auto-reconnect must never block startup: a headset that's off or out of range
# should not delay the API coming up. 5s is enough for a BLE session to prepare.
_AUTO_RECONNECT_TIMEOUT_S = 5.0


async def _auto_reconnect() -> None:
    """Best-effort single reconnect to the last-paired device on boot.

    Reads the persisted ``last_paired_device`` row; if present, attempts one
    connect with a short timeout. Never raises — on failure the user can still
    Scan+Connect from the UI.
    """
    from neurolink_v2.domain.device.manager import device_manager
    from neurolink_v2.domain.device.preferences import get_last_paired

    try:
        last = await get_last_paired()
    except Exception:
        log.debug("auto_reconnect skipped: could not read last-paired device", exc_info=True)
        return
    if not last or not last.get("ble_address"):
        return

    address = last["ble_address"]
    log.info("auto_reconnect_attempt device=%s address=%s", last.get("display_name"), address)
    try:
        await asyncio.wait_for(device_manager.connect(address), timeout=_AUTO_RECONNECT_TIMEOUT_S)
        log.info("auto_reconnect_success device=%s", last.get("display_name"))
    except asyncio.TimeoutError:
        log.info("auto_reconnect_failed reason=timeout after %ss", _AUTO_RECONNECT_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — never fail startup on reconnect
        log.info("auto_reconnect_failed reason=%s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB (runs Alembic to head), then kick off a background
    auto-reconnect to the last-paired device. Shutdown: nothing extra needed
    (device is stopped via the /device/disconnect endpoint)."""
    await init_db()
    asyncio.create_task(_auto_reconnect())
    yield


def configure_logging() -> None:
    """Set the root log level from settings.log_level (env var LOG_LEVEL).

    Defaults to INFO so the per-frame DSP debug lines stay silent in a normal
    session; set LOG_LEVEL=DEBUG to bring them back for troubleshooting.
    """
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=level)
    logging.getLogger().setLevel(level)


def create_app() -> FastAPI:
    configure_logging()
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
    app.include_router(journal_router, prefix="/api/journal", tags=["Journal & Goals"])
    app.include_router(meditation_router, prefix="/api/meditation", tags=["Meditation"])
    app.include_router(practice_router, prefix="/api/practice", tags=["Practice Tracker"])
    app.include_router(signal_router, prefix="/api/signal", tags=["Signal Detail"])

    return app


app = create_app()
