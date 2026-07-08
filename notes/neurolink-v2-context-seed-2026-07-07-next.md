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
- Session history cards now show a `Reviewing` badge for the currently loaded review target
- The selected session-history review action now reads `In review`
- Session history artifact rows now render a compact grouped `Artifacts` chip with chip-style artifact links
- Session history summary detail panels now render compact chips for primary channel, alpha/(alpha+beta), fast/total, and slow/total, with guidance retained below the chip row
- Session history recording metadata detail panels now render compact chips for duration, EEG packets, and `Metadata: heuristic fallback` only for fallback-derived metadata
- Frontend now has minimal Vitest + Testing Library UI test infrastructure
- Frontend UI coverage includes a smoke test, a session-history provenance regression test, a review-time Recording context provenance test, and a review-time short-session caution test
- Latest session review shows a caution in the Signal note card when the analyzed session is short
- Frontend live console now includes a compact Live status bar summarizing headset presence, recording state, review target, and analysis/signal interpretation state
- Analysis responses include `recording_metadata`
- `recording_metadata` includes `recording_metadata_source` with values `manifest`, `fallback`, and `unknown`
- Review-time `Recording context` renders metadata provenance as `persisted manifest`, `heuristic fallback`, or `unknown`

## Latest relevant commits

Latest pushed commits before this handoff:

- `af1dbbf` — Tighten session history artifact row
- `0c5fc41` — Clarify active session review state
- `e517d71` — Compact session history detail chips
- `0226312` — Clarify session history review action
- `d1dc16e` — Improve live console status bar

## Permanent workflow policy
These rules are non-optional for every future Neurolink-v2 session:

1. Start every session with the exact verification block:
   ```bash
   cd ~/Neurolink-v2
   git status
   pytest -q
   npm --prefix frontend run build
   npm --prefix frontend run test:run
   sed -n '1,260p' notes/neurolink-v2-context-seed-2026-07-07-next.md
   ```
2. Inspect first, patch second. Never propose or apply a patch until the exact live file contents and patch anchors have been inspected with `sed`, `nl`, `grep`, or equivalent commands.
3. Never rely on memory for file contents, line ranges, or repo state. Re-inspect before each new patch.
4. Never require manual editing. Use exact, copy-pasteable shell commands or guarded scripts only.
5. Make one focused change at a time, then rerun the relevant verification commands before committing.
6. Commit only intended files, and keep handoff/context notes in a tracked path such as `notes/`, not `output/`.
7. At the end of each slice, update the handoff note if workflow, verified baseline, recent commits, or the next-session starting point has changed.

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
- `frontend/src/main.jsx` — operator console, live status bar, session recording/review UI, live channel label mapping, Signal note card, recording context card, provenance rendering, session-history badges, fallback metadata detail hints, and exportable app entry for UI tests
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

Next slice: pause on review/history scanability unless a new concrete usability issue appears, or begin a different low-risk frontend ergonomics pass from a fresh inspection of the exact rendered path.

## Why this is the best next slice

- The recent review/history scanability goals are now materially improved through compact detail chips, clearer reviewed-session state treatment, and a tighter artifact row.
- This is a good stopping point on the current frontend ergonomics thread before diminishing-return polish work accumulates.
- The repo is currently in a clean, fully verified state, which makes preserving this baseline preferable to forcing another small tweak immediately.

## Exact next-step instructions

1. Start with the session verification block in the permanent workflow policy.
2. Inspect the exact current rendered path with `grep`, `sed`, and `nl` before proposing any further patch.
3. Prefer a different low-risk frontend ergonomics target unless a concrete remaining review/history issue is observed first.
4. Update or extend frontend UI tests only if the visible accessible text or rendered semantics change.
5. After the slice, rerun:
  ```bash
  npm --prefix frontend run test:run
  npm --prefix frontend run build
  pytest -q
  git status
  ```
6. Update this note again if the verified baseline, latest commits, or next objective changed.
