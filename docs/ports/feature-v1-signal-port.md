# Port: `feature/v1-signal-port` — Neurolink-v1 DSP stack → v2

Ports Neurolink-v1's mature DSP pipeline into v2's domain-sliced layout,
Athena-only. Source of authority: `audit_reports/AUDIT_REPORT.md` §4 (PR 2).

## Scope

- Port v1's signal-processing modules + their unit tests into
  `neurolink_v2/domain/signal/dsp/` and `neurolink_v2/domain/signal/stage0/`.
- Wire the ported `EEGPipeline` into the live WebSocket EEG pump (additively —
  the legacy per-channel band-power path is preserved for frontend compat).
- Expose stream-quality metrics via `GET /api/stream/health`.
- Port the session-start resting baseline + Stage-0 gate into
  `neurolink_v2/domain/session/calibration.py`.

## Ported modules

All copied from `Neurolink-v1/backend/src/neurolink/` and rewritten to v2
import paths (`neurolink.dsp.X` → `neurolink_v2.domain.signal.dsp.X`).

`domain/signal/dsp/`:
`artifact_config`, `artifact_detector`, `artifact_gate`, `asr`, `bad_channels`,
`bandpower`, `baseline`, `breathing`, `cardiac_regression`, `classifiers`,
`derived_eeg`, `filter_toggles`, `fnirs`, `imu`, `ocular_regression`,
`online_filter`, `pipeline`, `ppg`, `spherical_spline`, `models`.

`domain/signal/stage0/`: `environment`, `impedance`, `imu_gate`, `__init__`
(`Stage0Guard` facade).

Tests copied from `Neurolink-v1/backend/tests/unit/dsp/` into `tests/dsp/`
(18 files + `conftest.py`), import paths adapted.

## New v2 glue (not ported verbatim)

- `domain/signal/service.py` — `SignalPipelineService` singleton wrapping one
  `EEGPipeline` with a `_NullHub` (v2 has no monolithic hub; baseline-complete
  is surfaced via `PipelineResult.baseline_phase`). Builds an `EEGSample` from
  each broadcaster snapshot and owns the live `StreamHealth`.
- `domain/stream/broadcaster.py` — the EEG pump now also calls
  `signal_service.process_snapshot()` and attaches `snap["pipeline"]` +
  `snap["stream_health"]`. Wrapped in try/except so a DSP fault never kills the
  pump; all existing keys are untouched.
- `domain/stream/router.py` — `GET /api/stream/health` → `StreamHealthPayload`.
- `domain/session/calibration.py` — `CalibrationController` wraps `Stage0Guard`
  + `BaselineRecorder`.

## Optimal-choice decisions (per "when in doubt, make the optimal choice")

- **Baseline duration**: kept v1's authoritative constants
  (`BASELINE_DISCARD_SEC=30 s`, `BASELINE_TOTAL_SEC=150 s`) from
  `artifact_config` as the single source of truth rather than inventing a
  shorter window.
- **Electrode type**: `artifact_gate._detect_electrode_type()` simplified to
  `return "dry"` (Athena uses dry electrodes exclusively); removed the dead
  v1 `adapter_factory`/`config` lookup path.
- **Pipeline wiring is additive**: the proven legacy band-power path and the
  WebSocket message schema the frontend depends on are left intact; the ported
  pipeline output is added under new keys. This de-risks the port.
- **`dsp/models.py`** authored clean, excluding v1's `ConnectRequest` /
  `SessionSummary` (they carried a non-Athena `muse_s_gen1` default). Raw
  optical channels preserved first-class via `OpticalPayload.optical_raw`.

## Muse-S sweep

`grep -rniE 'MUSE_EEG_UUIDS|MUSE_S_UUID|ble_mgr|MUSE_S_AAAA_BOARD|Muse[_ ]?S(...)'`
over all added/modified files returns **zero**. Product-name comments were
reworded to "Muse Athena".

## Test commands + results (Linux, Python 3.11 target)

- `python -m pytest -q` → **439 passed**
- `npm --prefix frontend run test:run` → **4 passed**
- `npm --prefix frontend run build` → **built OK**

## Deferred

- Full replacement of the legacy per-channel band-power path with
  `PipelineResult.bands` (frontend contract change) — deferred to keep this PR
  additive and green.
- Persisting calibration/baseline snapshots to SQLite — belongs with PR 3's
  Alembic migration that extends the sessions tables.
