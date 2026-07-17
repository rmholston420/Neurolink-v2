# Tier-A Visualization Port (v1 → v2)

Ports the full Tier-A EEG visualization set from Neurolink v1 into the v2
meditation-first shell (PR #4). **Muse Athena only** — every legacy non-Athena
Muse code path is excluded; the four frontal electrodes (TP9/AF7/AF8/TP10)
appear only as
pre-first-frame fallbacks, tagged `TODO: verify Athena channel names`.

All components live in `frontend/src/components/signal/` (TypeScript `.tsx`), are
wired to real WebSocket / REST data via `useNeurolinkWS` + `useNeurolinkStore`,
and are assembled in `frontend/src/pages/SignalPage.tsx`. Canvas components redraw
on the 30fps store tick. Colors come from `frontend/src/lib/tokens.css` via the
`frontend/src/lib/vajra.ts` palette helper — no hardcoded hex except data-ramp
values that are themselves derived from Vajra Night tokens.

## Component map

| # | v2 component | v1 source (behavior ported) | Data source | Notes |
|---|---|---|---|---|
| 1 | `TopoMap.tsx` | v1 frontal topographic heatmap | `channelBands` (WS `band_powers` → label-keyed) | Canvas IDW (p=2, 64×64), `rampTopo` teal→indigo→fire, band selector, empty state, no synthetic fill |
| 2 | `RollingSpectrogram.tsx` | v1 per-channel spectrogram | `signals` (WS raw `eeg` → label-keyed) | Canvas time×freq, Hann DFT, log-freq y, `rampSpectro` teal→indigo→fire→gold, 60s window, `mean` channel option |
| 3 | `BandPowerChart.tsx` | v1 `BandPowerChart` (legacy band bars) | `channelBands` | One column/channel, 5 band bars, 240ms width easing, `BAND_VAR` colors |
| 4 | `BandTrend.tsx` (restyle) | v1 `BandTrendCard` | store `bandHistory` | Rewritten to grid + tokens; SVG paths, `BAND_GLYPH` legend |
| 5 | `SignalPipelinePanel.tsx` | v1 StreamHealth widget | `GET /api/stream/health` (1s poll) + WS `pipeline` | frames total/clean/rejected, packet_loss_pct, avg_tick_ms, last_frame age, packet-loss sparkline (60s), artifact gate pill |
| 6 | `ContactQuality.tsx` | v1 per-electrode contact dots | WS `contact` (new, from `frame_metrics.py`) | good≥0.6 / fair≥0.3 / poor; falls back to TP9/AF7/AF8/TP10 |
| 7 | `ImpedancePanel.tsx` | v1 impedance readout | WS `impedance` (new, RMS heuristic proxy in kΩ) | Athena has no impedance channel — labeled "heuristic proxy"; IQR outlier fence; never mocked |
| 8 | `FocusFatigueGauge.tsx` | v1 focus/fatigue gauges | WS `focus_state`/`focus_score`/`fatigue` (new) | Twin radial SVG gauges; focus engagement = beta/(alpha+theta), fatigue = theta/alpha |
| 9 | `ConnectivityArc.tsx` | v1 connectivity/PLV arcs | `signals` (raw EEG) | **Improved**: real client-side Pearson correlation of raw buffers (v1 used band-power cosine + synthetic fallback); no synthetic fill; threshold slider |
| 10 | `DeviceStatusBar.tsx` | v1 device status strip | store `battery`, `contactMean`, `source`, `connected` | In-page horizontal variant; see decision below |
| 11 | `CalibrationPanel.tsx` | v1 calibration compare | `GET /meditation/calibration/latest` + live bands | Visualization only (baseline vs live); capture flow stays in the meditation controller |

## Backend deltas (already committed on this branch, 76ad85c)

- **`neurolink_v2/domain/signal/frame_metrics.py`** (new) — `compute_frame_metrics(eeg, channel_names, bands)` returns `{contact, impedance, focus_state, focus_score, fatigue}`, keyed by Athena channel label. Impedance is an RMS-derived heuristic proxy (kΩ); focus engagement = beta/(alpha+theta); fatigue = theta/alpha.
- **`neurolink_v2/domain/stream/broadcaster.py`** — `_eeg_pump` now merges `compute_frame_metrics(...)` into each EEG snapshot (guarded; failures logged at debug, never fatal).
- **`tests/test_frame_metrics.py`** (new) — 7 unit tests (empty inputs, label keying, flat→high impedance, healthy→low impedance, fallback names, focus HIGH when engaged, fatigue rises with theta/alpha).

No new REST endpoints were required. `contact`/`impedance`/`focus_*`/`fatigue`
ride the existing EEG WS frame; the wire contract is extended in
`frontend/src/lib/wire.ts` (`EegFrame`) and surfaced through
`frontend/src/hooks/useNeurolinkStore.ts`.

## Design decisions

- **DeviceStatusBar kept (not skipped).** The persistent right-rail `DeviceRail`
  owns the always-on summary; `DeviceStatusBar` is the compact in-page strip atop
  the Signal grid (battery segments, signal bars, source pill) driven by mean
  contact. It complements rather than duplicates the rail.
- **ConnectivityArc computes a real metric.** v1 approximated PLV from band-power
  cosine similarity with a synthetic-noise fallback. v2 computes absolute Pearson
  correlation of the raw per-electrode sample buffers client-side (broadband
  coupling proxy) — hardware samples only, no synthetic fallback.
- **Impedance is honest.** Athena exposes no impedance channel; the panel is
  clearly labeled a heuristic RMS proxy rather than mocking a hardware value.
- **LegacyConsole de-duplicated.** The ported Tier-A widgets
  (`OperatorChannelCard`, `QualityBadge`, `BandTrendCard`, legacy `BandPowerChart`)
  were removed from `LegacyConsole.jsx` and the now-orphaned
  `components/legacy/LegacyBandCharts.jsx` was deleted. The Journal operator
  console retains its session recording / history / provenance surface.

## Screenshots

_Device unavailable in this environment; capture on Collosus with a live Athena
stream._

- `![Signal page — full grid](./img/tier-a-signal-grid.png)` _(placeholder)_
- `![TopoMap + FocusFatigue](./img/tier-a-topo-focus.png)` _(placeholder)_
- `![Pipeline + Impedance](./img/tier-a-pipeline-impedance.png)` _(placeholder)_

## Wire format sample

See `docs/ports/wire-format-sample-tier-a.json` — three EEG frames showing the new
`contact`/`impedance`/`focus_*`/`fatigue` fields (synthetic but shape-accurate;
no headset attached in this env).

## Verification

- `pytest -q` → 540 passed
- `npm --prefix frontend run test:run` → 14 files, 32 tests passed
- `npm --prefix frontend run build` → clean
- `npx tsc --noEmit` (in `frontend/`) → clean
- Legacy non-Athena Muse sweep on `git diff --name-only main...HEAD` (pattern
  covering the legacy BLE UUID constants, the legacy BLE manager symbol, and the
  older Muse device token) → zero matches across changed files.
