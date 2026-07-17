"""Athena hardware backends: transport-abstracted data sources."""

from .base import (
    ATHENA_EEG_FS,
    ATHENA_IMU_FS,
    ATHENA_OPT_FS,
    AthenaBackend,
)
from .factory import build_backend

__all__ = [
    "ATHENA_EEG_FS",
    "ATHENA_IMU_FS",
    "ATHENA_OPT_FS",
    "AthenaBackend",
    "build_backend",
]
