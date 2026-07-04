from __future__ import annotations

from fastapi import FastAPI, WebSocket

from neurolink_v2.api_streaming.ws import StreamHub
from neurolink_v2.device_control.discovery import scan_for_muse_devices

app = FastAPI(title='Neurolink-v2 API')
hub = StreamHub()


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/devices/scan')
async def devices_scan(timeout: float = 5.0):
    devices = await scan_for_muse_devices(timeout)
    return [d.to_dict() for d in devices]


@app.post('/session/start')
async def session_start(mac_address: str = ''):
    await hub.start(mac_address=mac_address)
    return {'status': 'started', 'mac_address': mac_address}


@app.post('/session/stop')
async def session_stop():
    await hub.stop()
    return {'status': 'stopped'}


@app.websocket('/ws/live')
async def ws_live(websocket: WebSocket):
    await hub.stream_client(websocket)
