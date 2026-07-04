from __future__ import annotations

from collections import deque
from typing import Any


class FrameBuffer:
    def __init__(self, maxlen: int = 128):
        self.frames: deque[dict[str, Any]] = deque(maxlen=maxlen)

    def push(self, frame: dict[str, Any]) -> None:
        self.frames.append(frame)

    def latest(self) -> dict[str, Any] | None:
        return self.frames[-1] if self.frames else None
