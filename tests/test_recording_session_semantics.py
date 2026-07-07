import json
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport

from neurolink_v2.main import app
from neurolink_v2.domain.stream import recorder


@pytest.fixture
def isolated_recorder_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(recorder, "DATA_DIR", tmp_path)
    recorder._recording_enabled = False
    recorder._current_file = None
    recorder._fh = None
    recorder._start_time = 0.0
    recorder._stop_time = 0.0
    recorder._packet_counts = {}
    return tmp_path


def test_session_stats_short_label_for_thin_recording(isolated_recorder_dir, monkeypatch):
    monkeypatch.setattr(recorder.time, "time", lambda: 100.0)
    recorder.start_recording()

    recorder.record_packet("eeg", {"samples": [1, 2, 3]})
    recorder.record_packet("optical", {"value": 1})

    monkeypatch.setattr(recorder.time, "time", lambda: 105.0)
    recorder.stop_recording()

    stats = recorder.session_stats()
    assert stats["duration_seconds"] == 5.0
    assert stats["eeg_packets"] == 1
    assert stats["session_label"] == "short"


def test_session_stats_ok_label_for_longer_recording(isolated_recorder_dir, monkeypatch):
    clock = {"t": 200.0}
    monkeypatch.setattr(recorder.time, "time", lambda: clock["t"])

    recorder.start_recording()
    for _ in range(25):
        recorder.record_packet("eeg", {"samples": [1, 2, 3]})

    clock["t"] = 212.5
    recorder.stop_recording()

    stats = recorder.session_stats()
    assert stats["duration_seconds"] == 12.5
    assert stats["eeg_packets"] == 25
    assert stats["session_label"] == "ok"


def test_stop_recording_writes_manifest_for_short_session(isolated_recorder_dir, monkeypatch):
    monkeypatch.setattr(recorder.time, "time", lambda: 100.0)
    session_path = Path(recorder.start_recording())

    recorder.record_packet("eeg", {"samples": [1, 2, 3]})
    recorder.record_packet("optical", {"value": 1})

    monkeypatch.setattr(recorder.time, "time", lambda: 105.0)
    recorder.stop_recording()

    manifest_path = session_path.with_suffix(".manifest.json")
    assert manifest_path.exists()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["session_file"] == str(session_path)
    assert manifest["session_name"] == session_path.name
    assert manifest["duration_seconds"] == 5.0
    assert manifest["eeg_packets"] == 1
    assert manifest["session_label"] == "short"
    assert manifest["recording_label"] == "short"
    assert manifest["packet_counts"]["eeg"] == 1
    assert manifest["packet_counts"]["optical"] == 1


def test_stop_recording_writes_manifest_for_ok_session(isolated_recorder_dir, monkeypatch):
    clock = {"t": 200.0}
    monkeypatch.setattr(recorder.time, "time", lambda: clock["t"])
    session_path = Path(recorder.start_recording())

    for _ in range(25):
        recorder.record_packet("eeg", {"samples": [1, 2, 3]})

    clock["t"] = 212.5
    recorder.stop_recording()

    manifest_path = session_path.with_suffix(".manifest.json")
    assert manifest_path.exists()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["duration_seconds"] == 12.5
    assert manifest["eeg_packets"] == 25
    assert manifest["session_label"] == "ok"
    assert manifest["recording_label"] == "ok"
    assert manifest["packet_counts"]["eeg"] == 25


def test_recording_metadata_helper_marks_short_session(tmp_path):
    from neurolink_v2.domain.session.analysis_router import _recording_metadata_for_session

    short_session = tmp_path / "session-20260706-120000.jsonl"
    short_session.write_text(
        "\n".join(
            json.dumps({"ts": i, "type": "eeg", "payload": {"value": i}})
            for i in range(5)
        ) + "\n",
        encoding="utf-8",
    )

    metadata = _recording_metadata_for_session(short_session)

    assert metadata["recording_label"] == "short"



def test_inject_short_session_caution_short(tmp_path):
    from neurolink_v2.domain.session.analysis_router import _inject_short_session_caution

    short_session = tmp_path / "session-20260706-120000.jsonl"
    short_session.write_text(
        "\n".join(
            json.dumps({"ts": i, "type": "eeg", "payload": {"value": i}})
            for i in range(5)
        ) + "\n",
        encoding="utf-8",
    )

    summary = _inject_short_session_caution({"overall_quality": "fair"}, short_session)

    assert summary["recording_label"] == "short"
    assert summary["short_session"] is True
    assert isinstance(summary["short_session_caution"], str)
    assert "lower confidence" in summary["short_session_caution"]


def test_inject_short_session_caution_ok(tmp_path):
    from neurolink_v2.domain.session.analysis_router import _inject_short_session_caution

    ok_session = tmp_path / "session-20260706-120500.jsonl"
    ok_session.write_text(
        "\n".join(
            json.dumps({"ts": i, "type": "eeg", "payload": {"value": i}})
            for i in range(25)
        ) + "\n",
        encoding="utf-8",
    )

    summary = _inject_short_session_caution({"overall_quality": "fair"}, ok_session)

    assert summary["recording_label"] == "ok"
    assert summary["short_session"] is False
    assert summary["short_session_caution"] is None


def test_inject_short_session_caution_unknown_when_missing_path():
    from neurolink_v2.domain.session.analysis_router import _inject_short_session_caution

    summary = _inject_short_session_caution({"overall_quality": "fair"}, None)

    assert summary["recording_label"] == "unknown"
    assert summary["short_session"] is False
    assert summary["short_session_caution"] is None

def test_recording_metadata_prefers_manifest(tmp_path):
    from neurolink_v2.domain.session.analysis_router import _recording_metadata_for_session

    session_path = tmp_path / "session-20260706-120000.jsonl"
    session_path.write_text(
        json.dumps({"ts": 1, "type": "eeg", "payload": {"value": 1}}) + "\n",
        encoding="utf-8",
    )

    manifest_path = session_path.with_suffix(".manifest.json")
    manifest_path.write_text(
        json.dumps(
            {
                "session_file": str(session_path),
                "session_name": session_path.name,
                "manifest_version": 1,
                "duration_seconds": 12.5,
                "packet_counts": {"eeg": 25},
                "eeg_packets": 25,
                "session_label": "ok",
                "recording_label": "ok",
                "start_time": 100.0,
                "stop_time": 112.5,
            }
        ) + "\n",
        encoding="utf-8",
    )

    metadata = _recording_metadata_for_session(session_path)

    assert metadata["recording_label"] == "ok"
    assert metadata["duration_seconds"] == 12.5
    assert metadata["eeg_packets"] == 25
    assert metadata["packet_counts"]["eeg"] == 25
    assert metadata["manifest_path"] == str(manifest_path)


def test_recording_metadata_falls_back_without_manifest(tmp_path):
    from neurolink_v2.domain.session.analysis_router import _recording_metadata_for_session

    session_path = tmp_path / "session-20260706-120500.jsonl"
    session_path.write_text(
        "\n".join(
            json.dumps({"ts": i, "type": "eeg", "payload": {"value": i}})
            for i in range(5)
        ) + "\n",
        encoding="utf-8",
    )

    metadata = _recording_metadata_for_session(session_path)

    assert metadata["recording_label"] == "short"
    assert "manifest_path" not in metadata
    assert metadata.get("duration_seconds") is None


