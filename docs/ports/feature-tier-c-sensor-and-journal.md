# Tier-C Sensor-Detail + Journal Port (v1 → v2)

Ports the Tier-C sensor-detail widgets and rebuilds the Journal review surface
from Neurolink v1 into the v2 meditation-first shell (PR #7). **Muse Athena
only** — no legacy non-Athena Muse code path is referenced, imported, or added;
the Muse-S sweep is clean across the entire branch diff.

Tier-C covers two areas:

1. **Sensor detail** — per-electrode bad-channel state, real-time artifact
   coaching, and a guided Stage-0 calibration ceremony, added to
   `frontend/src/pages/SignalPage.tsx`.
2. **Journal rebuild** — the v1 Journal (session history + per-session review)
   rebuilt as first-class TypeScript components under
   `frontend/src/components/journal/`, replacing the retired v1 `LegacyConsole`
   review surface. WanderingLog gains real tag persistence.

All components are TypeScript `.tsx`, wired to **real** WebSocket / REST data via
`useNeurolinkStore` + the typed `apiClient` wrappers; every widget renders an
honest empty / insufficient-data state — nothing is mocked or synthesized.
Colors come from the shared theme tokens via the `vajra` palette helper — no
hardcoded hex.

## Component map

v1 source lives under `/home/user/workspace/audit/Neurolink-v1/frontend/src/components/`.

| # | v2 component | v1 source (behavior ported) | Data source | Notes |
|---|---|---|---|---|
| 1 | `components/signal/BadChannelPanel.tsx` | `BadChannelPanel.tsx` | WS `eeg.bad_channels` (`{flagged, reasons, interpolation_active}` from Stage-2) + `GET/POST /api/signal/bad-channels` | Per-electrode bad state, per-channel reasons, interpolation-active flag, manual override toggle |
| 2 | `components/signal/ArtifactGuidePanel.tsx` | `ArtifactGuidePanel.tsx` | WS `eeg.artifacts` (per-class blink/emg/movement/saturation/drift + overall `score`) | Per-class real-time coaching; maroon when a class is active, teal when clean; honest empty state when the frame carries no artifact block |
| 3 | `components/signal/CalibrationCeremony.tsx` | `CalibrationPanel.tsx` (v1 capture flow, reworked) | `GET /api/meditation/stage0-readiness` + `POST .../ack`; capture posts to the meditation calibration store | Stage-0 pre-flight + 90s guided capture (30s warmup + 60s baseline) + post-flight save; wired to the DeviceRail "Recalibrate" action. `CalibrationPanel.tsx` (Tier-A) remains the live baseline-vs-live compare view |
| 4 | `components/journal/SessionHistoryPanel.tsx` | `SessionHistoryPanel.tsx` | `GET /api/sessions/` enriched per-row with `GET /api/sessions/{id}/summary` | Sortable (date / duration / EA-1 seconds) + filterable (label / stage / preset) list; per-row CSV/JSON export links; selecting a row raises `onSelect` for the detail view |
| 5 | `components/journal/SessionDetailView.tsx` | v1 Journal detail surface (rebuilt) | `GET /api/sessions/{id}`, `.../wandering-events`, `.../export`; recording-analysis via `/api/sessions/analyze-*` | Deep per-session view: EA-1 / stage / band / wandering timelines, notes, export, and the recording-analysis panel ported from the retired v1 console review surface |
| 6 | `components/practice/WanderingLog.tsx` (persistence) | `WanderingLog.tsx` | `useWanderingDetector` + `POST /api/sessions/wandering-events` (unattached) | Tag persistence added: each tagged episode is persisted in real time via the unattached wandering-events endpoint (`session_id=null`, since the live shell records to JSONL and has no DB session row) |

## Backend deltas (committed on PR #7 branch)

- **WS frame (`StreamBroadcaster`)** — two additive top-level blocks on each EEG
  frame:
  - `artifacts` — per-class coaching scores (`blink`, `emg`, `movement`,
    `saturation`, `drift`) plus an overall `score`, folded from the 7-type
    `ArtifactDetector`. A frame hard-rejected by the coarse Stage-3
    amplitude/kurtosis gate never reaches the Stage-3b classifier, so its scores
    stay `0` and `artifact_rejected` is `true`.
  - `bad_channels` — structured `{flagged, reasons, interpolation_active}` from
    Stage-2. Both blocks are **omitted** when the pipeline yields no result, so
    the UI renders an honest insufficient-data state rather than a fabricated
    value.
- **New REST endpoints:**
  - `GET /api/meditation/stage0-readiness` + `POST
    /api/meditation/stage0-readiness/ack` — calibration pre-flight readiness and
    acknowledgement.
  - `GET /api/signal/bad-channels` + `POST /api/signal/bad-channels/manual` —
    read current bad-channel state and apply a manual override.
  - `GET/POST /api/sessions/{id}/wandering-events` — attached wandering events
    for a recorded session.
  - `POST /api/sessions/wandering-events` — unattached wandering events
    (`session_id=null`), used by the live-shell WanderingLog.
  - `GET /api/sessions/{id}/summary` — cheap per-session aggregates
    (`frame_count`, `ea1_eligible_seconds`, `dominant_stage`, notes / wandering
    counts) that enrich the Journal history rows.
  - `GET /api/sessions/{id}/export?format=csv|json` — per-session timeline
    export.
- **Migration:** `migrations/versions/0003_wandering_events.py` — adds the
  `wandering_events` table (FK → `sessions.id`, nullable). Run `alembic upgrade
  head` on Collosus before first use.

The `artifacts` / `bad_channels` blocks ride the existing EEG WS frame; the wire
contract is extended in `frontend/src/lib/wire.ts` and surfaced through
`frontend/src/hooks/useNeurolinkStore.ts`. The typed session / signal / stage-0
wrappers live in `frontend/src/lib/apiClient.ts`.

## Design decisions

- **Unattached wandering events (`session_id=null`).** The live meditation shell
  records to JSONL session files and has no DB `sessions` row, so real-time
  WanderingLog tags are persisted as unattached events. Attached
  (`/sessions/{id}/wandering-events`) events remain available for the Journal
  detail timeline once a session row exists.
- **CalibrationCeremony is distinct from CalibrationPanel.** The Tier-A
  `CalibrationPanel` is a passive live-vs-baseline compare view; the new
  `CalibrationCeremony` owns the active Stage-0 pre-flight → 90s guided capture →
  save flow and is invoked from the DeviceRail "Recalibrate" action. Keeping them
  separate avoids overloading a visualization widget with a capture state
  machine.
- **Artifact scores are honest.** A frame hard-rejected by the coarse Stage-3
  amplitude/kurtosis gate never reaches the Stage-3b classifier; its per-class
  scores stay `0` and `artifact_rejected` is `true` rather than being
  back-filled with a guess.
- **Journal rebuilt in TypeScript, not extended.** Rather than keep patching the
  v1 `LegacyConsole` Journal DOM, the review surface was rebuilt as
  `SessionHistoryPanel` + `SessionDetailView`. The recording-analysis
  (analyze-latest / per-file analyze + artifact downloads) surface was carried
  over into `SessionDetailView` so provenance/analysis stays reachable. This
  retirement is completed in the follow-up branch
  `feature/legacy-console-retirement`.
- **Partial delivery boundary (PR #7).** PR #7 stopped at the last stable commit
  to ship a mergeable draft; the LegacyConsole file deletion and this docs page
  were explicitly deferred and are delivered in the follow-up branch.

## Muse-S sweep (branch diff)

```
$ { git diff --name-only main...HEAD; git diff --name-only; \
    git ls-files --others --exclude-standard; } | sort -u \
    | xargs grep -rniE 'MUSE_EEG_UUIDS|MUSE_S_UUID|ble_mgr|Muse[_ ]?S([^_A-Za-z]|$)'
(no matches)
```

## Collosus run instructions

```bash
# backend (Kubuntu "Collosus")
cd Neurolink-v2
alembic upgrade head                 # apply 0003_wandering_events
uvicorn neurolink_v2.main:app --host 0.0.0.0 --port 8008

# frontend
cd frontend
npm install
npm run dev                          # Vite dev server
```

## Screenshots

_Placeholders — device unavailable in this environment; capture on Collosus with
a live Athena stream._

- `docs/ports/img/tier-c-signal-badchannel-artifact.png` — BadChannelPanel +
  ArtifactGuidePanel on the Signal page _(TODO)_
- `docs/ports/img/tier-c-calibration-ceremony.png` — CalibrationCeremony Stage-0
  pre-flight + guided capture _(TODO)_
- `docs/ports/img/tier-c-journal-history.png` — SessionHistoryPanel with sort /
  filter / export _(TODO)_
- `docs/ports/img/tier-c-journal-detail.png` — SessionDetailView timelines +
  notes + export _(TODO)_

## Wire format sample

See `docs/ports/wire-format-sample-tier-c.json` — representative WS EEG frames
after the Tier-C delta showing the additive `artifacts` and `bad_channels`
blocks (produced by running synthetic EEG through the real DSP pipeline; fields
are omitted when the pipeline yields no result).

## Verification

- `pytest -q` → 569 passed
- `npm --prefix frontend run test:run` → 30 files, 72 tests passed
- `npx tsc --noEmit` (in `frontend/`) → clean
- `npm --prefix frontend run build` → clean
- Muse-S sweep on `git diff --name-only main...HEAD` → zero matches

## Follow-up recommendations

- **Attach live-shell sessions to DB rows.** Once the live meditation shell
  writes a `sessions` row (not just JSONL), migrate the unattached
  wandering-events to attached so the Journal detail timeline is complete without
  a reconciliation step.
- **Capture the screenshot set on Collosus** with a live Athena stream and drop
  the images into `docs/ports/img/`, replacing the TODO placeholders above.
- **Backfill a wandering-events summary aggregate** into
  `GET /api/sessions/{id}/summary` if per-tag counts are needed in the history
  rows (currently only a total `wandering_count` is surfaced).
- **Impedance/bad-channel provenance.** Consider persisting manual bad-channel
  overrides per session so a reviewer can see which channels were excluded during
  a recording, not just the live state.
