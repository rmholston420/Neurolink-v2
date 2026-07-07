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
- Frontend UI tests pass: `npm --prefix frontend run test:run`
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
- Frontend now has minimal Vitest + Testing Library UI test infrastructure
- Frontend UI coverage includes a smoke test, a session-history provenance regression test, a review-time Recording context provenance test, and a review-time short-session caution test
- Latest session review shows a caution in the Signal note card when the analyzed session is short
- Analysis responses include `recording_metadata`
- `recording_metadata` includes `recording_metadata_source` with values `manifest`, `fallback`, and `unknown`
- Review-time `Recording context` renders metadata provenance as `persisted manifest`, `heuristic fallback`, or `unknown`

## Latest relevant commits
Latest pushed commits before this handoff:

- `e424433` — Add short session review caution UI test
- `ffb77e1` — Add review panel provenance UI test
- `ca5c63e` — Stabilize frontend UI fetch mocks

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
- `frontend/src/main.jsx` — operator console, session recording/review UI, live channel label mapping, Signal note card, recording context card, provenance rendering, session-history badges, fallback metadata detail hints, and exportable app entry for UI tests
- `frontend/vite.config.js` — Vite + Vitest frontend test configuration
- `frontend/src/test/app.smoke.test.jsx` — frontend smoke test
- `frontend/src/test/session-history-provenance.test.jsx` — frontend regression test for fallback provenance rendering

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
Next slice: refresh this tracked handoff note so it reflects the newly landed frontend review-coverage work, then begin the next coding session from fresh inspection of the current frontend and backend surfaces to choose a new small objective.

## Why this is the best next slice
- The previously documented review-panel provenance objective has already been completed and pushed.
- Frontend UI coverage now protects session-history fallback provenance, review-time manifest provenance, and review-time short-session caution.
- The highest-value immediate gap is now project-context drift: the tracked note no longer matches the latest landed commits or the current tested frontend coverage.
- Refreshing the note keeps the next session grounded in the real repo state before selecting a new feature or hardening slice.

## Exact next-step instructions
1. Update this note’s latest-commits section and verified frontend UI coverage bullets to reflect the newly landed review tests.
2. Replace the completed review-panel objective with a workflow note that the next coding session should begin from fresh inspection-driven objective selection.
3. Run:
   ```bash
   cd ~/Neurolink-v2
   git diff -- notes/neurolink-v2-context-seed-2026-07-07-next.md
   git add notes/neurolink-v2-context-seed-2026-07-07-next.md
   git commit -m "Refresh handoff note after review UI tests"
   git push origin main
   ```
4. In the following session, start with:
   ```bash
   cd ~/Neurolink-v2
   git status
   pytest -q
   npm --prefix frontend run build
   npm --prefix frontend run test:run
   sed -n '1,260p' notes/neurolink-v2-context-seed-2026-07-07-next.md
   ```
