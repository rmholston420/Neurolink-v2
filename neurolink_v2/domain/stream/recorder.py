from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Optional

_recording_enabled: bool = False
_current_file: Optional[Path] = None
_fh = None

DATA_DIR = Path.home() / "Neurolink-v2" / "data" / "sessions"

_start_time: float = 0.0
_stop_time: float = 0.0
_packet_counts: Dict[str, int] = {}


def _manifest_path_for_session(session_path: Path) -> Path:
    return session_path.with_suffix(".manifest.json")


def _write_session_manifest(session_path: Path) -> None:
    stats = session_stats()
    manifest = {
        "session_file": str(session_path),
        "session_name": session_path.name,
        "manifest_version": 1,
        "start_time": stats.get("start_time"),
        "stop_time": stats.get("stop_time"),
        "duration_seconds": stats.get("duration_seconds"),
        "packet_counts": stats.get("packet_counts", {}),
        "eeg_packets": stats.get("eeg_packets"),
        "session_label": stats.get("session_label"),
        "recording_label": stats.get("session_label"),
    }
    manifest_path = _manifest_path_for_session(session_path)
    try:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        pass


def _ensure_open() -> None:
    global _fh, _current_file
    if _fh is not None:
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    _current_file = DATA_DIR / f"session-{ts}.jsonl"
    _fh = _current_file.open("a", buffering=1, encoding="utf-8")


def start_recording() -> str:
    global _recording_enabled, _start_time, _stop_time, _packet_counts
    _recording_enabled = True
    _start_time = time.time()
    _stop_time = 0.0
    _packet_counts = {}
    _ensure_open()
    return str(_current_file) if _current_file else ""

def stop_recording() -> None:
    global _recording_enabled, _fh, _current_file, _stop_time
    session_path = _current_file
    _recording_enabled = False
    _stop_time = time.time()
    if _fh is not None:
        try:
            _fh.flush()
        except Exception:
            pass
        try:
            _fh.close()
        except Exception:
            pass
    _fh = None
    if session_path is not None:
        _write_session_manifest(session_path)
    _current_file = None

def is_recording() -> bool:
    return _recording_enabled


def current_path() -> str:
    return str(_current_file) if _current_file else ""


def record_packet(kind: str, payload: Dict[str, Any]) -> None:
    if not _recording_enabled:
        return
    global _fh, _packet_counts
    _packet_counts[kind] = _packet_counts.get(kind, 0) + 1
    if _fh is None:
        _ensure_open()
    if _fh is None:
        return
    entry = {
        "ts": time.time(),
        "type": kind,
        "payload": payload,
    }
    try:
        _fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass

def session_stats() -> Dict[str, Any]:
  """Return simple stats for the current or last recording session."""
  duration = 0.0
  if _start_time and _stop_time:
      duration = max(0.0, _stop_time - _start_time)
  elif _start_time and _recording_enabled:
      duration = max(0.0, time.time() - _start_time)

  packet_counts = dict(_packet_counts)
  eeg_packets = int(packet_counts.get("eeg", 0))
  session_label = "short" if duration < 10.0 or eeg_packets < 20 else "ok"

  return {
      "start_time": _start_time or None,
      "stop_time": _stop_time or None,
      "duration_seconds": duration,
      "packet_counts": packet_counts,
      "eeg_packets": eeg_packets,
      "session_label": session_label,
  }
