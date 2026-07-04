from __future__ import annotations

import asyncio
from fastapi import WebSocket

from neurolink_v2.device_control.brainflow_athena import AthenaSession
from neurolink_v2.signal_pipeline.processor import FrameBuffer


class StreamHub:
    def __init__(self):
        self.buffer = FrameBuffer()
        self.session: AthenaSession | None = None
        self.running = False

    async def start(self, mac_address: str = "") -> None:
        self.session = AthenaSession()
        if mac_address:
            self.session.config.mac_address = mac_address
        self.session.connect()
        self.running = True
        asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self.running = False
        if self.session is not None:
            self.session.disconnect()
            self.session = None

    async def _loop(self) -> None:
        while self.running and self.session is not None:
            frame = self.session.read_frame()
            self.buffer.push(frame)
            await asyncio.sleep(0.1)

    async def stream_client(self, websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            while True:
                frame = self.buffer.latest() or {'status': 'waiting'}
                await websocket.send_json(frame)
                await asyncio.sleep(0.1)
        finally:
            await websocket.close()
