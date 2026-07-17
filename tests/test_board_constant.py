"""Guard: the v1 board constant must never leak into v2.

v2 targets BrainFlow >= 5.22 where the Athena board is ``MUSE_S_ATHENA_BOARD``.
v1 used ``MUSE_S_AAAA_BOARD``.  Any occurrence of the old constant (or Muse-S
BLE artifacts) in the shipped package is a port bug.
"""

import re
from pathlib import Path

import pytest

_PKG = Path(__file__).resolve().parent.parent / "neurolink_v2"

# Patterns that must not appear in shipped source.
_FORBIDDEN = re.compile(r"MUSE_S_AAAA_BOARD|MUSE_EEG_UUIDS|MUSE_S_UUID")


def _py_files():
    return sorted(_PKG.rglob("*.py"))


def test_no_forbidden_constants_in_package():
    offenders = []
    for path in _py_files():
        text = path.read_text(encoding="utf-8")
        if _FORBIDDEN.search(text):
            offenders.append(str(path.relative_to(_PKG.parent)))
    assert not offenders, f"Forbidden Muse-S constants found in: {offenders}"


@pytest.mark.parametrize("path", _py_files(), ids=lambda p: p.name)
def test_athena_board_constant_used(path):
    """Wherever a Muse board id is referenced, it must be the Athena one."""
    text = path.read_text(encoding="utf-8")
    if "MUSE_S_" in text:
        assert "MUSE_S_ATHENA_BOARD" in text
        assert "MUSE_S_AAAA_BOARD" not in text
