# Port note: `feature/brainflow-athena-backend`

Scope: introduce a transport abstraction so BrainFlow is one backend among many,
preserve raw optical (fNIRS) channels first-class, and expose transport metadata
on frames and on the device status endpoint.

Reference: `audit_reports/AUDIT_REPORT.md` §4 (PR 1) and §2.1.

## Ported / new modules

| New module | Source (Neurolink-v1) |
|---|---|
| `neurolink_v2/domain/device/backends/base.py` (`AthenaBackend` Protocol + `ATHENA_*_FS`) | `backend/src/neurolink/hardware/muse_athena/backend.py` |
| `neurolink_v2/domain/device/backends/brainflow_backend.py` (`AthenaBrainFlowBackend`) | `backend/src/neurolink/hardware/muse_athena/brainflow_backend.py` |
| `neurolink_v2/domain/device/backends/lsl_backend.py` (`AthenaLslBackend`) | `backend/src/neurolink/hardware/muse_athena/ble_adapter.py` (`AthenaLslBackend`) |
| `neurolink_v2/domain/device/adapter.py` (`AthenaBlueAdapter`, `AthenaSample`) | `backend/src/neurolink/hardware/muse_athena/ble_adapter.py` (`AthenaBlueAdapter`) |
| `neurolink_v2/domain/device/backends/factory.py` (`build_backend`) | new (v1 had an adapter factory) |

## Key adaptations

- **Board constant renamed** `MUSE_S_AAAA_BOARD` → `MUSE_S_ATHENA_BOARD` everywhere,
  matching v2's BrainFlow >= 5.22. `transport_metadata.board_id` reports the Athena id.
- **Legacy stripped.** v1's backward-compat cruft (5th zero-padded EEG ring, classic
  PPG ring, LSL/BLE dual-inheritance shims, contract-test inlet injection) removed.
  The adapter is Athena-only and delegates purely through the `AthenaBackend` protocol.
- **Raw optical is first-class.** `AthenaSample.optical_raw: list[list[float]]` and the
  new `OpticalPayload` model preserve the 5-optode frontal fNIRS array (850/730/660 nm).
  It is never collapsed into a PPG-only signal.
- **Sampling rates** confirmed against the BrainFlow board descriptor at connect-time,
  with the documented Athena fallbacks (EEG 256 Hz, optical 64 Hz, IMU 52 Hz).
- **Frame model extended** (`signal_pipeline/models.py`): `optical_buffer`,
  `optical_sampling_rate_hz`, `modality_sampling_rates`, `transport_metadata`.
- **Config**: `settings.transport` ("brainflow" | "lsl"); `build_backend()` selects it.

## Muse-S grep sweep

`grep -rniE 'MUSE_EEG_UUIDS|MUSE_S_UUID|ble_mgr|Muse[_ ]?S([^_A-Za-z]|$)'` over the
added/modified source returns **zero** code-path matches. The only remaining
occurrences are the literal product name "Muse S Athena" (with a space, not the
`MUSE_S_` code token) in pre-existing files, and the guard regex/strings inside
`tests/test_board_constant.py`, which exist precisely to enforce this rule.

## Tests

- `tests/test_athena_backends.py` — Protocol conformance for all three backends,
  parametric transport-metadata checks, adapter frame assembly via a `FakeAthenaBackend`
  (raw optical preserved, battery, sampling rates), and factory selection.
- `tests/test_board_constant.py` — fails if `MUSE_S_AAAA_BOARD` / Muse-S UUIDs leak.

Commands run (Linux, Python 3.11 target):

```
python -m pytest -q                       # 66 passed
npm --prefix frontend run test:run        # 4 passed
npm --prefix frontend run build           # ok
```
