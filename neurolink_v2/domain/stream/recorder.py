from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Optional

_recording_enabled: bool = False
_current_file: Optional[Path] = None
_fh = None

DATA_DIR = Path.home() / "Neurolink-v2" / "data" / "sessions"


def _ensure_open() -> None:
    global _fh, _current_file
    if _fh is not None:
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    _current_file = DATA_DIR / f"session-{ts}.jsonl"
    _fh = _current_file.open("a", buffering=1, encoding="utf-8")


def start_recording() -> str:
    global _recording_enabled
    _recording_enabled = True
    _ensure_open()
    return str(_current_file) if _current_file else ""


def stop_recording() -> None:
    global _recording_enabled, _fh, _current_file
    _recording_enabled = False
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
    global _fh
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
