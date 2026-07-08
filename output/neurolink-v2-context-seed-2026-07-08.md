# Neurolink-v2 Context Seed (2026-07-08)

Use this file at the start of a fresh session. High-quality handoffs should capture the current goal, what was completed, what changed, important files, known issues, and the exact next action to take.

## Project overview

Neurolink-v2 is a Python + FastAPI backend with a React frontend for discovering, connecting to, and streaming live data from a Muse Athena headset, with live EEG display, bandpower computation, debug telemetry, signal-quality classification, recording, and session analysis artifacts.

Repository: rmholston420/Neurolink-v2. Local work in this pass landed primarily in frontend/src/main.jsx, and the app is run locally with uvicorn neurolink_v2.main:app --reload --port 8008.

## Completed this session

- The frontend console now includes a global status chip row under the title for Device, Stream, Recording, Optical, and IMU state.
- A getStreamHealthStyle helper was added in frontend/src/main.jsx to map stream state onto the existing QUALITY_STYLES palette.
- The Live counts card now includes Stream health, Optical, and IMU chips in addition to raw sample counts.
- A new Aux sensors card was added to surface optical and IMU telemetry in a more operator-friendly way.
- The Stream chip in both the global status row and Live counts card is lightly color-coded using existing quality styles.
- These frontend console ergonomics changes were committed and pushed to origin/main in commit cc1b307.

## Current state

### Working well

- Muse Athena discovery/connect works.
- Live EEG websocket streaming works.
- Battery telemetry is visible during streaming.
- Per-channel band powers, quality status, and operator guidance are shown in the frontend live console.
- Latest analysis summary and latest session review show labeled primary channels and Signal note interpretation.
- The operator console now has improved at-a-glance stream and auxiliary sensor visibility.

### Still in progress

- Backend pytest was previously blocked in the local environment by missing Python test dependencies such as numpy and httpx.
- Signal-quality heuristics remain first-pass and are not yet calibrated against a real labeled Athena dataset.
- Athena disconnect teardown still logs unsubscribe warnings that may deserve defensive handling or explicit documentation if reconnect issues appear later.
- Backend signal-quality guidance hardening in neurolink_v2/domain/signal/quality.py remains the best next domain slice after testability is restored.

## Important files

Backend:
- neurolink_v2/main.py — FastAPI app entrypoint and router integration.
- neurolink_v2/domain/stream/broadcaster.py — live websocket payload assembly, including band_powers, band_debug, and band_quality.
- neurolink_v2/domain/signal/bandpower.py — PSD and bandpower computation.
- neurolink_v2/domain/signal/quality.py — signal-quality heuristics and next likely backend target.
- neurolink_v2/domain/session/analysis_router.py — session analysis endpoints and ratio-summary path.

Frontend:
- frontend/src/main.jsx — main operator console, session recording/review UI, channel label mapping, Signal note card, status chips, Live counts enhancements, and Aux sensors card.

Artifacts / docs:
- output/neurolink-v2-build-plan.md — domain-sliced build plan.
- output/neurolink-v2-context-seed-2026-07-06.md — previous seed.
- output/neurolink-v2-context-seed-2026-07-08.md — this updated seed.

## Known issues and gotchas

- Muse Athena EEG fast-band activity can reflect muscle artifact rather than cortical signal, so beta/gamma-heavy windows should not be overinterpreted without quality gating.
- The current quality classifier is heuristic, not yet validated on a labeled Athena dataset.
- Athena teardown on Linux/BrainFlow may log unsubscribe errors for control/data characteristics during disconnect even when stop/disconnect succeed from the app’s point of view.
- Shell workflow matters: commands should be exact pasteable terminal commands that cd into the correct directory, do one focused action, and print OK only if that action succeeds.
- output/ is ignored by Git, so seed files there must be force-added if they should be versioned.

## Recommended next objective

Best next slice: restore backend testability, then harden signal-quality guidance.

Why this is optimal:
- The frontend live console ergonomics pass is now pushed and stable enough for checkpointing.
- Reliable automated verification should be restored before deeper backend heuristic changes.
- After that, neurolink_v2/domain/signal/quality.py is the highest-value domain improvement for better operator guidance.

## Exact next-step instructions

1. Activate the project .venv and ensure numpy and httpx are installed there.
2. Run backend pytest from the repo root and confirm whether tests pass once dependencies are present.
3. After backend testability is restored, inspect neurolink_v2/domain/signal/quality.py and refine quality.status, quality.reason, and quality.guidance for common artifact patterns.
4. Run the frontend build and dev smoke checks again after any further main.jsx edits.

## Suggested kickoff prompt

Read output/neurolink-v2-build-plan.md and this seed first. Then continue from the latest verified baseline: frontend console ergonomics are pushed on main, the repo working tree is clean, and the next goals are to restore backend pytest coverage and then harden backend signal-quality guidance.
