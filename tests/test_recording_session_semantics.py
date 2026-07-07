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


def test_recording_label_helper_marks_short_session(tmp_path):
    from neurolink_v2.domain.session.analysis_router import _recording_label_for_session

    short_session = tmp_path / "session-20260706-120000.jsonl"
    short_session.write_text(
        "\n".join(
            json.dumps({"ts": i, "type": "eeg", "payload": {"value": i}})
            for i in range(5)
        ) + "\n",
        encoding="utf-8",
    )

    assert _recording_label_for_session(short_session) == "short"



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
