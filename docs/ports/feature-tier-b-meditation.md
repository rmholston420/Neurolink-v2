# Tier-B Meditation Port (v1 → v2)

Ports the full Tier-B meditation / contemplative-practice feature set from
Neurolink v1 into the v2 meditation-first shell. **Muse Athena only** — no
legacy non-Athena Muse code path is referenced, imported, or added. The
Muse-S sweep below is clean across the entire branch diff.

All ten components live in `frontend/src/components/practice/` (TypeScript
`.tsx`), are wired to **real** WebSocket / REST data via `useNeurolinkStore`
(WS-fused HRV / breathing / EA-1) and the seven Tier-B hooks, and are assembled
as first-class citizens in `frontend/src/pages/PracticePage.tsx`. Colors come
from `frontend/src/theme/tokens.css` via the `frontend/src/lib/vajra.ts` palette
helper — no hardcoded hex. Every widget renders an honest "insufficient data"
state when a value cannot be computed; nothing is mocked or synthesized.

## Component map

| # | v2 component | Purpose | Data source | Empty / insufficient-data state |
|---|---|---|---|---|
| 1 | `HRVCoherenceTrainer.tsx` | Coherence gauge + rolling coherence trend + HR / score / sample count | `store.hrv.ibi_ms` → `useHRVCoherence` (DFT dominant-peak concentration) | "Gathering heartbeats…" until ≥8 IBIs |
| 2 | `BreathingPanel.tsx` | 5.5 bpm pacer ring (10.9 s period), guided + adaptive modes, inhale/hold/exhale/hold phase, coherence readout | `store.breathing` (rate_bpm, phase) + coherence | "Awaiting breath signal" |
| 3 | `MeditationTimer.tsx` | Configurable duration (5/10/20/30/45 m), settling→main→dedication phases, soft chimes + interval bell, pause/resume/end | `useAudioFeedback` + `useBaselineBell` | Idle until "Begin session" |
| 4 | `EA1Score.tsx` | Per-criterion progress bars (HRV RMSSD, breath 4–8 bpm, FAA>0, FMθ≥0.15, Poincaré≥0.70), s-space + motion hard-gate viz, eligible-seconds counter, score timeline, current label | `store.ea1` (`Ea1Result`) | "Awaiting live signal to score EA-1." |
| 5 | `AlchemicalJournal.tsx` | Nigredo→Albedo→Citrinitas→Rubedo→Conjunctio stage path + transition history + notes | `useAlchemicalJournal` (stage transitions; notes via `/api/journal/notes`) | "No notes yet" |
| 6 | `WanderingLog.tsx` | Attention-wandering timeline with per-event intensity + tags | `useWanderingDetector` (Euclidean jump on the state vector) | "Steady so far" |
| 7 | `SessionGoals.tsx` | User goals with progress bars + bump / delete, persisted | `useSessionGoals` (`/api/journal/goals`) | "No goals yet" |
| 8 | `PersonalBaseline.tsx` | Live bands vs calibrated baseline with signed deltas | `usePersonalBaseline` (`GET /api/meditation/calibration/latest`) | "No baseline captured yet." |
| 9 | `SSpaceDisplay.tsx` | Enlarged α–θ state plane (regions A–H), gate zone tinted gold, live point | `store.meditation` (alpha, theta, region, stage) | Plane renders; point sits at origin with no signal |
| 10 | `AudioFeedbackPanel.tsx` | Mute / volume / soundscape (silence, singing-bowl, alpha binaural, theta binaural, guided breath) via Web Audio synthesis — no external assets | `useAudioFeedback` (shared engine) | "Audio output is unavailable" when `AudioContext` is absent |

## Hook map

| Hook | Returns | Notes |
|---|---|---|
| `useHRVCoherence(ibiMs)` | `{ coherence, history, score, hr }` | Pure `computeCoherence(ibiMs)` (naive DFT, MIN_IBIS=8); no output below threshold |
| `useAudioFeedback(breathPeriodMs?)` | `AudioFeedback` (mute/volume/soundscape/playChime/supported) | Web Audio synthesis; fully no-op (`supported=false`) under jsdom / unsupported browsers |
| `useBaselineBell({enabled, intervalMs, onRing})` | `{ lastRing, ringNow }` | `setInterval`-driven, fires immediately via `ringNow` |
| `usePersonalBaseline(liveBands)` | `{ baseline, label, createdAt, deltas, loaded, refresh }` | Pure `parseBaseline(raw)` maps `*_base` keys; deltas = live − base |
| `useWanderingDetector(vec, opts)` | `{ events, tag, clear }` | Pure `vectorDistance`; emits past cooldown when jump ≥ threshold; intensity clamped |
| `useAlchemicalJournal(stage, region?)` | `{ stage, transitions, notes, loaded, addNote, refreshNotes }` | Appends transitions on stage change (deduped); notes via `journalApi` |
| `useSessionGoals()` | `{ goals, loaded, addGoal, updateGoal, deleteGoal, refresh }` | Ignores empty goal text; wraps `journalApi` |

All seven hooks are TypeScript and vitest-tested (`src/test/use*.test.ts`).

## Gold Breath Halo

`NeurofeedbackGauge.tsx` gains a `breathPeriodMs` prop (default `BREATH_PERIOD_MS`
≈ 10909 ms). The halo pulses on the breath beat: **gold and brighter on-beat when
EA-1-eligible**, dimming to indigo when not eligible. `prefers-reduced-motion`
renders a static gold ring (no pulsing). `PracticePage` feeds
`breathPeriodMs` from `store.breathing.rate_bpm` so the halo tracks the
meditator's measured cadence when available and falls back to the 5.5 bpm target
otherwise.

## Backend deltas (already committed on this branch, 6527718)

- **`neurolink_v2/domain/signal/frame_hrv.py`** (new) — computes additive `hrv`
  and `breathing` blocks fused from the cross-pump optical (PPG) and IMU
  (accel-z) buffers. Both blocks are **omitted** until enough data accumulates
  (~15 s PPG / ~10 s accel), so the UI renders an honest insufficient-data state
  rather than a fabricated value.
- **`neurolink_v2/domain/stream/broadcaster.py`** — merges the HRV / breathing
  blocks into each EEG WS frame (guarded; failures never fatal).
- **`neurolink_v2/domain/session/models.py` + `journal_router.py`** — persistence
  and REST for session goals (`/api/journal/goals`) and journal notes
  (`/api/journal/notes`).
- **`migrations/versions/0002_session_goals.py`** (new) — Alembic migration
  adding the `session_goals` (and journal notes) tables. Run `alembic upgrade
  head` on Collosus before first use.
- **`tests/test_frame_hrv.py`, `tests/test_journal_api.py`** (new) — unit +
  API coverage for the deltas.
- **`docs/ports/wire-format-sample-tier-b.json`** — three representative,
  schema-accurate WS frames after the delta.

The `hrv` / `breathing` blocks ride the existing EEG WS frame; the wire contract
is extended in `frontend/src/lib/wire.ts` and surfaced through
`frontend/src/hooks/useNeurolinkStore.ts`. The EA-1 result type is extended in
`frontend/src/lib/apiClient.ts` (`gates`, `criteria`, `s_space_region`,
`overlay_mode`, `integration_coverage`) so `EA1Score` can render the gate viz
without additional backend work.

## Design decisions

- **BreathingPanel and HRVCoherenceTrainer are distinct components.** Although
  both touch the breath pacer, the v1 brief lists them separately: the pacer
  drives breath cadence, while the coherence trainer is HRV-centric (gauge +
  trend + score). Keeping them separate mirrors v1 and lets the timer and pacer
  compose independently.
- **One shared audio engine.** `AudioFeedbackPanel` takes an existing
  `useAudioFeedback` instance (created on the page) rather than instantiating its
  own, so the timer's chimes and the soundscape share a single `AudioContext`.
- **EA-1 shared classification.** `PracticePage` consumes `store.ea1` (the WS-fed
  classification) rather than re-running a client-side classify effect, so every
  widget agrees on eligibility.
- **LegacyConsole cleanup.** `MeditationPanel` (the only Tier-B widget present in
  `LegacyConsole.jsx`) was removed from the legacy console along with its now-dead
  `meditationBands` / `meditationFaa` derivations. It survives as a first-class
  citizen on `PracticePage`.

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
alembic upgrade head                 # apply 0002_session_goals
uvicorn neurolink_v2.main:app --host 0.0.0.0 --port 8008

# frontend
cd frontend
npm install
npm run dev                          # Vite dev server
```

## Screenshots

_Placeholders — capture on Collosus with a live Athena stream._

- `docs/ports/img/tier-b-practice-overview.png` — full Practice page grid
- `docs/ports/img/tier-b-ea1-score.png` — EA1Score criterion bars + gates
- `docs/ports/img/tier-b-breathing-halo.png` — gold breath halo on-beat
- `docs/ports/img/tier-b-sspace.png` — enlarged α–θ plane with live point
