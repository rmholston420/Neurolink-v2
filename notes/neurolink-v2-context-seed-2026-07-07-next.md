# Neurolink-v2 context seed — 2026-07-07 next

## Project overview
Neurolink-v2 is a Python + FastAPI backend with a React frontend for discovering, connecting to, and streaming live data from a Muse Athena headset, with live EEG display, bandpower computation, debug telemetry, signal-quality classification, recording, session analysis artifacts, and a session history/review workflow.

Repository: `rmholston420/Neurolink-v2`

Local run command:
```bash
uvicorn neurolink_v2.main:app --reload --port 8008
```

## Verified baseline at handoff
The current baseline is verified and stable:

- Backend tests pass: `pytest -q` → `25 passed`
- Frontend production build passes: `npm --prefix frontend run build`
- Git state is clean after push
- Branch state is synced: `main` is up to date with `origin/main`
- Muse Athena discovery/connect works
- Live EEG websocket streaming works
- Battery telemetry is visible during streaming
- Per-channel band powers, `band_debug`, `band_quality`, and operator guidance are shown in the frontend live console
- Live Athena channel labels map correctly to `TP9`, `AF7`, `AF8`, and `TP10`
- Session recording works
- Recorder persists a per-session manifest adjacent to each session JSONL
- Latest-session analysis works
- Analyze-by-name works
- Session history listing works
- Session-review artifact links exist
- Frontend session cards show a `Short recording` badge when the backend marks a session as short
- Frontend session history cards now also show `Metadata: heuristic` only for fallback-based legacy metadata
- Session history recording metadata detail panels now show `Metadata source: heuristic fallback` only for fallback-derived metadata
- Latest session review shows a caution in the Signal note card when the analyzed session is short
- Analysis responses include `recording_metadata`
- `recording_metadata` includes `recording_metadata_source` with values `manifest`, `fallback`, and `unknown`
- Review-time `Recording context` renders metadata provenance as `persisted manifest`, `heuristic fallback`, or `unknown`

## Latest relevant commits
Latest pushed commits before this handoff:

- `a73aab5` — Show recording metadata provenance in review
- `88cd4e6` — Show fallback metadata hint in session history
- `4856bc5` — Clarify fallback metadata in session history details

## Important files
### Backend
- `neurolink_v2/main.py` — FastAPI app entrypoint and router integration
- `neurolink_v2/domain/stream/broadcaster.py` — live websocket payload assembly, including `band_powers`, `band_debug`, `band_quality`, and battery telemetry
- `neurolink_v2/domain/stream/recorder.py` — recording lifecycle, packet persistence, session stats, derived session label, per-session manifest writing
- `neurolink_v2/domain/stream/recording_router.py` — recording status/start/stop routes, with `stats` exposure
- `neurolink_v2/domain/signal/bandpower.py` — PSD and bandpower computation
- `neurolink_v2/domain/signal/quality.py` — signal-quality heuristics and session guidance logic
- `neurolink_v2/domain/session/analysis_router.py` — latest-session analysis, analyze-by-name, session history listing, summary hardening, manifest-aware recording metadata, metadata provenance, short-session caution injection
- `tools/analyze_session.py` — post-session artifact generation script

### Frontend
- `frontend/src/main.jsx` — operator console, session recording/review UI, live channel label mapping, Signal note card, recording context card, provenance rendering, session-history badges, and fallback metadata detail hints

### Tests
- `tests/test_bandpower.py`
- `tests/test_device_router.py`
- `tests/test_signal_quality.py`
- `tests/test_recording_session_semantics.py`

## Known issues and gotchas
- Muse Athena fast-band activity can reflect muscle artifact rather than cortical activity, so beta/gamma-heavy windows should not be overinterpreted without quality gating.
- The signal-quality classifier is still heuristic and not yet calibrated on a labeled Athena dataset.
- Athena teardown on Linux/BrainFlow may still log unsubscribe warnings during disconnect even when stop/disconnect succeed from the app’s point of view.
- Historical sessions may still rely on fallback metadata if no manifest exists for that session.
- `recording_metadata_source == "fallback"` means session semantics are heuristic rather than authoritative.
- Avoid committing transient frontend debug artifacts like `frontend/src/latest-eeg-snapshot.json`.

## Correct workflow for this repo
1. Start each work block by confirming the current state:
   ```bash
   cd ~/Neurolink-v2
   git status
   pytest -q
   npm --prefix frontend run build
   ```
2. Read the actual current handoff/context note before editing code.
3. Verify file paths before using `sed` or patching commands.
4. Inspect the exact rendered code path before patching.
5. Make one focused change at a time.
6. After each intended slice, rerun:
   ```bash
   npm --prefix frontend run build
   pytest -q
   git status
   ```
7. Commit only the intended code changes.
8. Do not rely on `output/` for versioned handoff notes.
9. Prefer a tracked location like `docs/` or `notes/` for durable handoff files.
10. Use exact, paste-ready shell commands only.

## Best next objective
Next slice: add a small regression test or UI-focused safeguard around fallback metadata presentation so the provenance behavior is less likely to drift during future session-history changes.

## Why this is the best next slice
- The frontend provenance story is now complete across review, history badges, and history metadata details.
- The next highest-value work is preserving that behavior rather than adding more UI text.
- A narrow safeguard is lower risk than another feature slice and helps keep future refactors honest.
- This also keeps the project in the current pattern of small, reversible hardening steps.

## Exact next-step instructions
1. Inspect existing frontend test coverage or current project conventions for UI verification.
2. If lightweight UI testing already exists, add one focused regression test for fallback provenance rendering.
3. If frontend UI tests do not exist yet, document the provenance expectations in the tracked handoff note and defer test harness work.
4. Keep the slice small; avoid mixing new backend logic with test/setup work.
5. Run:
   ```bash
   cd ~/Neurolink-v2
   npm --prefix frontend run build
   pytest -q
   git status
   ```
6. Commit only the focused safeguard or note update.
