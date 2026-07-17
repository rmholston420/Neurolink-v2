"""Smoke test for GET /api/stream/health."""

from __future__ import annotations

from fastapi.testclient import TestClient

from neurolink_v2.main import create_app


def test_stream_health_endpoint_returns_payload():
    client = TestClient(create_app())
    resp = client.get("/api/stream/health")
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "frames_total",
        "frames_rejected",
        "frames_clean",
        "packet_loss_pct",
        "last_frame_ts",
        "avg_tick_ms",
    ):
        assert key in body
