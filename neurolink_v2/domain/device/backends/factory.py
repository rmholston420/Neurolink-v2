"""Backend factory -- select an AthenaBackend from runtime config."""

from __future__ import annotations

from neurolink_v2.domain.config.settings import settings

from .base import AthenaBackend


def build_backend(transport: str | None = None) -> AthenaBackend:
    """Construct the configured AthenaBackend.

    Parameters
    ----------
    transport:
        ``"brainflow"`` (default) or ``"lsl"``.  Falls back to
        ``settings.transport`` when ``None``.
    """
    choice = (transport or settings.transport).lower()
    if choice == "lsl":
        from .lsl_backend import AthenaLslBackend

        return AthenaLslBackend()
    if choice == "brainflow":
        from .brainflow_backend import AthenaBrainFlowBackend

        return AthenaBrainFlowBackend(
            mac_address=settings.muse_mac_address,
            serial_number=settings.muse_serial_number,
            other_info=settings.brainflow_other_info,
        )
    raise ValueError(f"Unknown transport {choice!r}; expected 'brainflow' or 'lsl'")
