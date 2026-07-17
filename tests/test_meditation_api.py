"""API smoke tests for meditation + practice routers."""

from __future__ import annotations

from fastapi.testclient import TestClient

from neurolink_v2.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_classify_endpoint():
    client = _client()
    resp = client.post(
        "/api/meditation/classify",
        json={"alpha": 1.5, "theta": 1.5, "beta": 0.3, "faa": 0.2},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["region"] == "H"
    assert body["alchemical_stage"] == "Conjunctio"
    assert body["ea1_result"]["s_space_region"] == "H"


def test_practice_recommend_endpoint():
    client = _client()
    client.post("/api/practice/lci", json={"value": 0.8})
    resp = client.get("/api/practice/recommend")
    assert resp.status_code == 200
    body = resp.json()
    assert "technique" in body
    assert "duration_minutes" in body


def test_practice_lci_history_endpoint():
    client = _client()
    client.post("/api/practice/lci", json={"value": 0.5})
    resp = client.get("/api/practice/lci/history")
    assert resp.status_code == 200
    assert "history" in resp.json()
