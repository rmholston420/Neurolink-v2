"""Integration smoke-tests for the device and stream REST endpoints.
Uses mocked device manager methods so no physical Muse is required."""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from neurolink_v2.main import app


@pytest.mark.asyncio
async def test_device_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        resp = await client.get('/api/device/status')
    assert resp.status_code == 200
    body = resp.json()
    assert 'is_streaming' in body
    assert 'preset' in body


@pytest.mark.asyncio
async def test_device_scan_mocked():
    with patch(
        'neurolink_v2.domain.device.router.scan_for_muse_devices',
        new_callable=AsyncMock,
        return_value=[],
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            resp = await client.get('/api/device/scan')
        assert resp.status_code == 200
        assert resp.json()['count'] == 0


@pytest.mark.asyncio
async def test_connect_disconnect_mocked():
    with patch(
        'neurolink_v2.domain.device.manager.device_manager.connect',
        new_callable=AsyncMock,
        return_value={'status': 'connected'},
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            resp = await client.post('/api/device/connect')
        assert resp.json()['status'] == 'connected'
