"""API tests for the Tier-C signal-detail router (bad-channel override)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from neurolink_v2.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_get_bad_channels_lists_all():
    client = _client()
    resp = client.get("/api/signal/bad-channels")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()["channels"]]
    assert "AF7" in names and "TP9" in names


def test_manual_flag_and_unflag_channel():
    client = _client()
    resp = client.post(
        "/api/signal/bad-channels/manual", json={"channel": "AF7", "bad": True}
    )
    assert resp.status_code == 200
    assert "AF7" in resp.json()["flagged"]
    # un-flag
    resp = client.post(
        "/api/signal/bad-channels/manual", json={"channel": "AF7", "bad": False}
    )
    assert "AF7" not in resp.json()["flagged"]


def test_manual_flag_unknown_channel_404():
    client = _client()
    resp = client.post(
        "/api/signal/bad-channels/manual", json={"channel": "ZZZ", "bad": True}
    )
    assert resp.status_code == 404
