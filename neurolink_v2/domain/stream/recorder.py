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
