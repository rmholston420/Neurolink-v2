"""In-memory signal-mode state for the live stream.

Three modes drive how the DSP pipeline treats each EEG frame:

* ``meditation`` (default) — the full DSP stack runs; only clean frames feed
  the meditation / EA-1 / HRV features. This is the shipping behaviour.
* ``notch`` — mains-hum removal only (scipy ``iirnotch`` at ``MAINS_HZ``,
  Q=30); the buffer/interpolation/amplitude-rejection stages are bypassed so a
  fit-checker sees the raw electrode signal with hum removed but no gating.
* ``raw`` — fully raw microvolts straight from the adapter; no filtering,
  rejection, or interpolation at all.

State is process-wide and intentionally *not* persisted: it resets to
``meditation`` on backend restart. The frontend re-syncs from ``localStorage``
on mount and on WebSocket reconnect.
"""

from __future__ import annotations

import threading

VALID_SIGNAL_MODES: tuple[str, ...] = ("meditation", "notch", "raw")
DEFAULT_SIGNAL_MODE: str = "meditation"


class StreamModeState:
    """Thread-safe holder for the current signal mode."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._mode = DEFAULT_SIGNAL_MODE

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def set_mode(self, mode: str) -> str:
        """Set and return the current mode. Raises ``ValueError`` on invalid input."""
        if mode not in VALID_SIGNAL_MODES:
            raise ValueError(
                f"Invalid signal mode '{mode}'. Must be one of {list(VALID_SIGNAL_MODES)}."
            )
        with self._lock:
            self._mode = mode
            return self._mode

    def reset(self) -> None:
        with self._lock:
            self._mode = DEFAULT_SIGNAL_MODE


stream_mode = StreamModeState()
