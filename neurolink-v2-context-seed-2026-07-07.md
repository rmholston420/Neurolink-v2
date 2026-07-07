# Neurolink-v2 Context Seed (2026-07-07)

Use this file at the start of a fresh session. High-quality handoffs should capture the current goal, what was completed, what changed, important files, known issues, and the exact next action to take.

## Project overview

Neurolink-v2 is a Python + FastAPI backend with a React frontend for discovering, connecting to, and streaming live data from a Muse Athena headset, with live EEG display, bandpower computation, debug telemetry, signal-quality classification, recording, and session analysis artifacts.

Repository: rmholston420/Neurolink-v2. Local app run command:

```bash
uvicorn neurolink_v2.main:app --reload --port 8008
```

## Completed this session

Frontend scanability work in `frontend/src/main.jsx` is now committed, pushed, and verified on `main`.

### Commits landed

- `5969578 fix: remove invisible duplicate paragraph from Signal note review card`
- `33dd1ab feat: improve review and history scanability`

### Frontend changes now on `main`

1. Latest session review → Signal note
   - Removed the invisible duplicate paragraph that previously used unreadable dark text.
   - Kept a single readable body paragraph using:
     - `getSignalGuidanceHint(reviewSummary)` first,
     - then `latestSessionSignalNote?.body`,
     - then fallback copy.
   - Added a compact subtitle line:
     - `latestSessionSignalNote?.title || 'Spectral summary'`
   - This makes the ratios-based spectral classification scannable at a glance in the review card.

2. Session history
   - Kept primary action buttons unchanged:
     - `Analyze`
     - `Open review`
     - `Reanalyze`
   - Grouped artifact links into a conditional labeled chip cluster:
     - `Artifacts:`
     - `Band chart`
     - `Summary CSV`
     - `Time series CSV`
   - Artifact links now use `detailChipBase`, improving visual grouping and action/download separation without changing behavior.

### Verification completed after push

From `frontend/`:

```bash
npm run build
npm run test
```

Results:
- Vite production build succeeded.
- Vitest passed:
  - `src/test/app.smoke.test.jsx`
  - `src/test/session-history-provenance.test.jsx`
- Total: 2 test files passed, 4 tests passed.

Git state after verification:
- `main` clean
- `origin/main` aligned
- latest frontend commit on `main`: `33dd1ab`

## Current state

### Working well

- Muse Athena discovery/connect works.
- Live EEG websocket streaming works.
- Battery telemetry is visible during streaming.
- Per-channel band powers, quality status, and operator guidance are shown in the live frontend console.
- Live channel semantics are corrected to TP9 / AF7 / AF8 / TP10 in the frontend operator cards.
- Session recording, latest-session analysis, session history listing, and artifact links exist.
- Latest session review now has a readable Signal note with a compact spectral subtitle.
- Session history now has grouped artifact chips under `Artifacts:`.
- Frontend build and current frontend UI tests are green on the updated code.

### Still in progress

- Backend session-analysis ratio hardening is the next highest-value step:
  - `alpha_over_alpha_beta`
  - `slow_over_total`
  - `fast_over_total`
  must be computed defensively and always present in the summary artifact, because the frontend Signal note and subtitle now depend on them.
- Signal-quality heuristics are still first-pass and not yet calibrated against a labeled Athena dataset.
- Athena disconnect teardown still logs unsubscribe warnings that may need defensive handling or documentation if they begin to affect reconnect behavior.

## Important files

Backend:
- `neurolink_v2/main.py`
- `neurolink_v2/domain/stream/broadcaster.py`
- `neurolink_v2/domain/signal/bandpower.py`
- `neurolink_v2/domain/signal/quality.py`
- `neurolink_v2/domain/session/analysis_router.py`

Frontend:
- `frontend/src/main.jsx`
- `frontend/src/test/app.smoke.test.jsx`
- `frontend/src/test/session-history-provenance.test.jsx`

Docs / artifacts:
- `neurolink-v2-build-plan.md`
- `neurolink-v2-context-seed-2026-07-06.md`

## Workflow lessons from this session

## Additional workflow lessons from front-page simplification (2026-07-07, late session)

- Front page is still visually overloaded: live controls, multi-panel live status, latest review, session history, and multiple debug surfaces all share one screen.
- Three separate scripted attempts to collapse debug and review surfaces in `frontend/src/main.jsx` failed due to brittle JSX anchors and off-by-one tail boundaries. Each failure temporarily broke the build and tests until `git restore -- frontend/src/main.jsx` returned the file to the last known good state.
- The final correct decision this session was to stop patching the front page and return to the verified baseline: `npm run build` and `npm run test:run` both passed after restoring `frontend/src/main.jsx`, and no UI changes from the failed collapses remain.
- Future front-page simplification must not use broad multiline replacement patches over long render paths. Instead, it should:
  - extract the exact local JSX block with `sed -n` before any change,
  - apply either a very small manual JSX edit or a narrowly scoped one-region patch, and
  - re-run `npm run build` and `npm run test:run` immediately afterward.
- Debug surfaces (Telemetry, Recent events, Latest optical frame, Latest IMU frame) are good candidates to hide behind a simple `showDebugPanels` toggle, but that work should be done in a fresh session with more careful, incremental edits rather than brittle automated surgery.
- Today’s failures are intentional lessons: do not attempt large scripted JSX surgery in `frontend/src/main.jsx` without exact local context and a plan to revert quickly if a build breaks.



1. Inspect exact rendered paths first.
   - For `frontend/src/main.jsx`, use local inspection such as:
     ```bash
     grep -n "Signal note" -A20 -B5 frontend/src/main.jsx
     grep -n "Review open\\|Band chart\\|Summary CSV\\|Time series CSV" -A20 -B10 frontend/src/main.jsx
     ```

2. Do not use brittle full-block replacement patches unless the exact local block has been confirmed.
   - Local JSX drift broke exact Python string replacement patches this session.

3. Use `git diff` before claiming anything is pending or complete.
   - Actual repo state was only clarified once `git diff -- frontend/src/main.jsx` was inspected.

4. Do not say “done” until verification is rerun on the updated code.
   - Correct final verification required:
     ```bash
     cd ~/Neurolink-v2/frontend && npm run build
     cd ~/Neurolink-v2/frontend && npm run test
     ```

5. Prefer non-watch test commands for final verification.
   - `package.json` defines:
     - `test`: `vitest`
     - `test:run`: `vitest run`
   - For future final checks, prefer:
     ```bash
     npm run test:run
     ```
     so the command exits cleanly instead of waiting for file changes.

## Known issues and gotchas

- Muse Athena EEG fast-band activity can reflect muscle artifact rather than cortical signal, so beta/gamma-heavy windows should not be overinterpreted without quality gating.
- The current quality classifier is heuristic, not yet validated on a labeled Athena dataset.
- Athena teardown on Linux/BrainFlow may log unsubscribe errors for control/data characteristics during disconnect even when stop/disconnect succeed from the app’s point of view.
- During a previous session, patches initially targeted the wrong code path because the rendered card title came from `label = getChannelLabel(...)`, not an earlier `channelLabel` variable; future edits in `frontend/src/main.jsx` must inspect the exact rendered JSX path before patching.
- Shell patch workflow matters: patches should be exact pasteable terminal commands that `cd` into the correct directory, make one focused change, and print `OK` only if the change applied successfully.

## Recommended next objective

Best next slice: harden latest-session analysis ratios in the backend, in `neurolink_v2/domain/session/analysis_router.py`, so the frontend review guidance remains safe and stable.

Why:
- The frontend now visibly depends on these ratios for both guidance text and spectral subtitle.
- Defensive ratio computation reduces breakage risk from partial sessions, zero-total power, and future analyzer changes.

## Exact next-step instructions

1. Open `neurolink_v2/domain/session/analysis_router.py` and locate where summary values are computed and written.
2. Ensure these are always computed safely:
   - `total = delta + theta + alpha + beta + gamma`
   - `slow_over_total = (delta + theta) / total` when `total > 0`, else `0.0`
   - `fast_over_total = (beta + gamma) / total` when `total > 0`, else `0.0`
   - `alpha_over_alpha_beta = alpha / (alpha + beta)` when `(alpha + beta) > 0`, else `0.0`
3. Ensure those three keys are always present in the summary artifact returned to the frontend, even for short or pathological sessions.
4. Run a fresh record/analyze cycle and verify the latest summary includes all three ratio fields before any further frontend guidance refinement.

## Suggested kickoff prompt

Read `neurolink-v2-build-plan.md` and this updated 2026-07-07 context seed first. Then inspect the current repository state and continue Neurolink-v2 from the last verified baseline: live streaming works, frontend review/history scanability improvements are committed and tested on `main`, and the next task is backend ratio hardening in `neurolink_v2/domain/session/analysis_router.py` so review guidance stays reliable.
