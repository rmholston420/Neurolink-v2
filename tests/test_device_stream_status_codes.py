"""Status-code + persistence tests for the device/stream REST surface (PR #11).

Covers Fix 3 (proper 4xx/5xx instead of 200-with-error-body) and the connect
persistence / last-paired endpoint added for Fix 2. Device manager and the
preferences store are mocked so no physical Muse or real DB write is required.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from neurolink_v2.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Fix 3: stream status codes ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_stream_conflict_when_not_connected():
    with patch("neurolink_v2.domain.stream.router.device_manager") as dm:
        dm.is_streaming = False
        async with _client() as client:
            resp = await client.post("/api/stream/start")
    assert resp.status_code == 409
    assert resp.json()["error"].startswith("Device not connected")


@pytest.mark.asyncio
async def test_start_stream_ok_when_connected():
    with patch("neurolink_v2.domain.stream.router.device_manager") as dm, patch(
        "neurolink_v2.domain.stream.router.broadcaster.start_pump", new_callable=AsyncMock
    ):
        dm.is_streaming = True
        async with _client() as client:
            resp = await client.post("/api/stream/start")
    assert resp.status_code == 200
    assert resp.json()["status"] == "streaming"


@pytest.mark.asyncio
async def test_stop_stream_conflict_when_not_streaming():
    with patch("neurolink_v2.domain.stream.router.broadcaster") as b:
        b.is_running = False
        async with _client() as client:
            resp = await client.post("/api/stream/stop")
    assert resp.status_code == 409
    assert resp.json()["error"] == "Not streaming"


@pytest.mark.asyncio
async def test_stop_stream_ok_when_streaming():
    with patch("neurolink_v2.domain.stream.router.broadcaster") as b:
        b.is_running = True
        b.stop_pump = AsyncMock()
        async with _client() as client:
            resp = await client.post("/api/stream/stop")
    assert resp.status_code == 200
    assert resp.json()["status"] == "stopped"


# ── Fix 3 + Fix 2: connect status codes + persistence ─────────────────────────


@pytest.mark.asyncio
async def test_connect_bad_request_when_no_address():
    with patch(
        "neurolink_v2.domain.device.router.get_last_paired",
        new_callable=AsyncMock,
        return_value=None,
    ), patch("neurolink_v2.domain.device.router.device_manager") as dm, patch(
        "neurolink_v2.domain.device.router.settings"
    ) as st:
        dm.has_board = False
        dm.is_streaming = False
        st.muse_mac_address = ""
        async with _client() as client:
            resp = await client.post("/api/device/connect", json={})
    assert resp.status_code == 400
    assert "error" in resp.json()


@pytest.mark.asyncio
async def test_connect_success_persists_last_paired():
    connect_mock = AsyncMock(return_value={"status": "connected", "board_id": 67})
    upsert_mock = AsyncMock(return_value={})
    with patch(
        "neurolink_v2.domain.device.router.get_last_paired",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "neurolink_v2.domain.device.router.upsert_last_paired", upsert_mock
    ), patch("neurolink_v2.domain.device.router.device_manager") as dm:
        dm.has_board = False
        dm.is_streaming = False
        dm.board_id = 67
        dm.connect = connect_mock
        async with _client() as client:
            resp = await client.post(
                "/api/device/connect",
                json={"ble_address": "00:55:DA:BA:23:4A", "display_name": "Athena-234A"},
            )
    assert resp.status_code == 200
    assert resp.json()["status"] == "connected"
    connect_mock.assert_awaited_once_with("00:55:DA:BA:23:4A")
    upsert_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_connect_idempotent_when_already_connected():
    connect_mock = AsyncMock(return_value={"status": "already_connected"})
    with patch("neurolink_v2.domain.device.router.device_manager") as dm:
        dm.has_board = True
        dm.is_streaming = True
        dm.connect = connect_mock
        async with _client() as client:
            resp = await client.post("/api/device/connect", json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "already_connected"


@pytest.mark.asyncio
async def test_connect_internal_error_becomes_500():
    with patch(
        "neurolink_v2.domain.device.router.get_last_paired",
        new_callable=AsyncMock,
        return_value=None,
    ), patch("neurolink_v2.domain.device.router.device_manager") as dm:
        dm.has_board = False
        dm.is_streaming = False
        dm.board_id = 67
        dm.connect = AsyncMock(side_effect=RuntimeError("BLE prepare_session failed"))
        async with _client() as client:
            resp = await client.post(
                "/api/device/connect", json={"ble_address": "00:55:DA:BA:23:4A"}
            )
    assert resp.status_code == 500
    assert "BLE prepare_session failed" in resp.json()["error"]


@pytest.mark.asyncio
async def test_last_paired_endpoint_returns_device():
    row = {"ble_address": "00:55:DA:BA:23:4A", "display_name": "Athena-234A", "preset": "p1041"}
    with patch(
        "neurolink_v2.domain.device.router.get_last_paired",
        new_callable=AsyncMock,
        return_value=row,
    ):
        async with _client() as client:
            resp = await client.get("/api/device/last-paired")
    assert resp.status_code == 200
    assert resp.json()["device"]["display_name"] == "Athena-234A"


@pytest.mark.asyncio
async def test_last_paired_endpoint_returns_null_when_unset():
    with patch(
        "neurolink_v2.domain.device.router.get_last_paired",
        new_callable=AsyncMock,
        return_value=None,
    ):
        async with _client() as client:
            resp = await client.get("/api/device/last-paired")
    assert resp.status_code == 200
    assert resp.json()["device"] is None
