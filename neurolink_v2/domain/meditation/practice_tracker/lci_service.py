"""LCI (Luminous Clarity Index) rolling-history service (ported from MuseLink).

MuseLink used module-level globals; ported here as a small class with a shared
singleton so it stays drop-in for the router while remaining unit-testable in
isolation (each test can construct its own ``LCIService``).
"""

from __future__ import annotations

from collections import deque


class LCIService:
    def __init__(self, maxlen: int = 200) -> None:
        self._history: deque[float] = deque(maxlen=maxlen)

    def record(self, value: float) -> None:
        self._history.append(float(value))

    def history(self, n: int = 50) -> list[float]:
        return list(self._history)[-n:]

    def mean(self, n: int = 50) -> float:
        h = self.history(n)
        return sum(h) / len(h) if h else 0.0

    def clear(self) -> None:
        self._history.clear()


lci_service = LCIService()
