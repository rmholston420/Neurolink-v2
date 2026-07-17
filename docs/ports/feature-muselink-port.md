# Port: MuseLink meditation domain → Neurolink-v2

Branch: `feature/muselink-port` (PR3). Corresponds to AUDIT_REPORT.md §4, PR 3.

## Scope

Ports MuseLink's **backend meditation-domain logic** (EA-1 eligibility scoring,
s-space / alchemical-stage classifier, practice tracker with LCI history and an
adaptive technique/duration recommender) into Neurolink-v2's domain-sliced
layout, plus a props-driven React panel that mirrors the classifier for a
no-round-trip live readout. Adds one Alembic migration that **extends** v2's
existing `sessions` table with `session_frames` + `calibrations`.

Athena-only: none of MuseLink's legacy BLE transport / decoder code paths are
ported. The domain logic is fully hardware-decoupled and consumes plain
band-power / HRV / IMU inputs. Muse-S grep sweep returns zero across all
added/modified files.

## Ported modules (source → destination)

Source root: `audit/MuseLink/backend/src/muselink/`

| MuseLink source | Neurolink-v2 destination |
| --- | --- |
| `ea1_scorer.py` | `neurolink_v2/domain/meditation/ea1_scorer.py` |
| `classifier.py` | `neurolink_v2/domain/meditation/classifier.py` |
| `models.py` | `neurolink_v2/domain/meditation/models.py` (pydantic v2, snake_case) |
| `neurolink/calibration_router.py` | `neurolink_v2/domain/meditation/router.py` + `calibration_service.py` |
| `neurolink/db.py` (raw DDL) | `migrations/versions/0001_meditation_tables.py` (Alembic) |
| `practice_tracker/adaptive_engine.py` | `neurolink_v2/domain/meditation/practice_tracker/adaptive_engine.py` |
| `practice_tracker/lci_service.py` | `neurolink_v2/domain/meditation/practice_tracker/lci_service.py` |
| `practice_tracker/practice_router.py` | `neurolink_v2/domain/meditation/practice_tracker/router.py` |

New (no MuseLink UI source exists):
- `frontend/src/components/sSpace.js` — client mirror of the backend classifier.
- `frontend/src/components/MeditationPanel.jsx` — props-driven panel.

## Key decisions

- **models.py** field names normalized to snake_case (`s_space_region`,
  `overlay_mode`, `integration_coverage`) to match v2's pydantic-v2 conventions.
- **EA-1 thresholds** kept authoritative from MuseLink: HRV RMSSD ≥ 40, breath
  4–8 BPM, FAA > 0, FMt ≥ 0.15, Poincaré SD1/SD2 ≥ 0.70, motion RMS ≤ 0.10,
  s-space gate `{E,F,G,H}`. Labels: Ineligible / EA1 Eligible / Deep Coherence /
  Peak Coherence.
- **SQLite: one migration, no parallel DB.** `session_frames.session_id` is an
  FK onto v2's existing `sessions.id`. `env.py` derives a sync URL from
  `settings.database_url` (strips `+aiosqlite` / `+asyncpg`). App bootstrap
  `init_db()` create_all precedes migration-managed extensions, so the migration
  test pre-creates the `sessions` table before `upgrade head`.
- **Frontend main.jsx left intact.** Per the audit guidance, splitting the
  fragile monolith was judged too risky for this PR; instead `MeditationPanel` is
  a self-contained, independently-tested component imported into `main.jsx` with
  a single insertion after the status-chip row. Recommend PR4 to split main.jsx.
- **LCI service** ported as a testable class + module singleton (`lci_service`).

## Routers mounted (neurolink_v2/main.py)

- `POST /api/meditation/classify` — IngestPayload → MeditationFrame.
- `POST /api/meditation/calibration/start|save`, `GET /api/meditation/calibration/latest`.
- `POST /api/practice/lci`, `GET /api/practice/lci/history`, `GET /api/practice/recommend`.

## Tests

- `tests/test_meditation_classifier.py`, `tests/test_meditation_api.py`,
  `tests/test_practice_tracker.py`, `tests/test_migration_meditation.py`.
- `frontend/src/test/meditation-panel.test.jsx`.
- Results: `pytest -q` → 42 passed; `npm --prefix frontend run test:run` → 10
  passed; `npm --prefix frontend run build` → OK.

## Muse-S grep sweep

```
grep -rniE 'MUSE_EEG_UUIDS|MUSE_S_UUID|ble_mgr|MUSE_S_AAAA_BOARD|Muse[_ ]?S([^_A-Za-z]|$)' <changed files>
```
Returns zero across all added/modified files.
