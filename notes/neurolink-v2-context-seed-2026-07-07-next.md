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
- Latest session review shows a caution in the Signal note card when the analyzed session is short
- Analysis responses include `recording_metadata`
- `recording_metadata` includes `recording_metadata_source` with values `manifest`, `fallback`, and `unknown`
- Review-time `Recording context` renders metadata provenance as `persisted manifest`, `heuristic fallback`, or `unknown`

## Latest relevant commits
Latest pushed commits before this handoff:

- `dd9af7f` — Annotate recording metadata provenance
- `a73aab5` — Show recording metadata provenance in review
- `88cd4e6` — Show fallback metadata hint in session history

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
- `frontend/src/main.jsx` — operator console, session recording/review UI, live channel label mapping, Signal note card, recording context card, provenance rendering, session-history badges

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
Next slice: reduce visual ambiguity for legacy sessions by surfacing provenance directly inside the recording metadata detail panel as well, but only when helpful and without cluttering manifest-backed sessions.

## Why this is the best next slice
- Provenance is now visible in review and in session-history badges.
- The remaining opportunity is to make legacy fallback semantics clearer in the metadata detail area itself.
- This would still be a small frontend-only follow-through.
- It keeps operator interpretation aligned with metadata authority without introducing backend risk.

## Exact next-step instructions
1. Open `frontend/src/main.jsx`.
2. Locate the `session.recording_metadata` detail block inside the session history card.
3. Add a subtle inline provenance row only when `session.recording_metadata.recording_metadata_source === "fallback"`.
4. Do not add extra text for `manifest`.
5. Keep styling quieter than the main badges.
6. Run:
   ```bash
   cd ~/Neurolink-v2
   npm --prefix frontend run build
   pytest -q
   git status
   ```
7. Commit only the focused frontend change.
