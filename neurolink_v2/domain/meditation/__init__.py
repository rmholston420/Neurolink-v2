"""Meditation domain — EA-1 eligibility, s-space / alchemical-stage classifier.

Ported from MuseLink (backend-only) into Neurolink-v2's domain-sliced layout.
Athena-only: none of MuseLink's legacy BLE transport / decoder code paths are
brought across — the domain logic here is fully decoupled from hardware and
consumes plain band-power / HRV / IMU inputs.
"""
