# Feature: Meditation-first frontend redesign

Branch: `feature/frontend-redesign` · Target: `main` · Device: **Muse Athena only**

This port replaces the v1 dev-console UI with a meditation-first shell. Every
surface binds to a real backend endpoint or a live WebSocket frame — there is no
mock data. New code is TypeScript (`.tsx`/`.ts`); the two domain files kept as-is
(`MeditationPanel.jsx`, `sSpace.js`) are imported unchanged.

## Design system

**Palette — "Vajra Night"** (`src/theme/tokens.css`, CSS variables):

| Token | Hex | Token | Hex |
|-------|-----|-------|-----|
| `--bg-void` | `#07080D` | `--accent-saffron` | `#F5A623` |
| `--bg-shrine` | `#0F1220` | `--accent-maroon` | `#8C2F39` |
| `--bg-shrine-hi` | `#161B33` | `--accent-gold` | `#D4AF37` |
| `--stroke-veil` | `#242A46` | `--accent-indigo` | `#3B4FE0` |
| `--ink-primary` | `#EDE7D3` | `--accent-teal` | `#2FB3A8` |
| `--ink-muted` | `#9AA0B8` | `--accent-lotus` | `#C97EB2` |
| `--ink-whisper` | `#5B617A` | `--accent-fire` | `#E85A4F` |
| `--halo-gold` | `rgba(212,175,55,0.35)` | `--accent-frost` | `#7FD1FF` |

Band → color: delta→deep, theta→lotus, alpha→teal, beta→indigo, gamma→fire.

**Typography** (`src/theme/typography.css`, `@fontsource`): Cormorant Garamond
(display), Inter (UI), JetBrains Mono (mono). Scale 12/14/16/20/28/40/64.

**Motion** (`src/theme/motion.ts`): easing `cubic-bezier(0.22,0.61,0.36,1)`, base
240 ms, ceremonial 800 ms. The Practice hero halo breathes at 5.5 bpm
(`BREATH_PERIOD_MS ≈ 10909 ms`) only while EA-1 eligible; `prefers-reduced-motion`
replaces the pulse with a static glow.

## Information architecture

`src/theme/shell.css` — CSS-grid shell: top nav (64px) · main · right Device
rail (200px) · bottom Command bar (56px). Three tabs:

- **Practice** (default) — `NeurofeedbackGauge` hero (coverage/engagement/EA-1
  arcs + gold breath halo), `MeditationPanel`, session-focus card, and the
  `PracticeTracker` (LCI trend + adaptive recommendation).
- **Signal** — rolling `BandTrend`, per-channel band powers, contact quality.
- **Journal** — the full ported operator console (`pages/LegacyConsole.jsx`):
  session history, provenance, analysis. Owns its own WS + session state.

## Component map

| Component | File | Source of data |
|-----------|------|----------------|
| `App` | `src/App.tsx` | `useNeurolinkStore` |
| `TopNav` / `DeviceRail` / `CommandBar` | `src/components/shell/*` | store |
| `NeurofeedbackGauge` | `src/components/practice/NeurofeedbackGauge.tsx` | `meditation` derived + EA-1 classify |
| `PracticeTracker` | `src/components/practice/PracticeTracker.tsx` | `/practice/*` |
| `BandTrend` | `src/components/signal/BandTrend.tsx` | `store.bandHistory` |
| `Card` / `StatusPill` | `src/components/ui/Card.tsx` | — |
| `LegacyConsole` | `src/pages/LegacyConsole.jsx` | own WS + `/sessions/*` |

State/wiring: `src/hooks/useNeurolinkStore.ts` (WS + device poll 2 s + health
poll 1 s + recording + band history + derived meditation metrics),
`src/hooks/useNeurolinkWS.ts` (WS client, 33 ms/30 fps batch tick),
`src/lib/apiClient.ts` (typed REST), `src/lib/wire.ts` (WS frame contract).

## Endpoint map

Config-driven via `VITE_API_BASE` (default `http://localhost:8008`); `src/lib/api.js`
derives `API_BASE = ${origin}/api` and the `ws(s)://…/api/stream/ws` URL.

| Area | Endpoints |
|------|-----------|
| Device | `GET /device/scan`, `POST /device/connect`, `POST /device/disconnect`, `GET /device/status` |
| Stream | `GET /stream/health`, `POST /stream/start`, `POST /stream/stop`, WS `/stream/ws`, `GET/POST /stream/recording(/start,/stop)` |
| Sessions | `GET /sessions/`, `GET /sessions/{id}`, `GET /sessions/history/list`, `POST /sessions/analyze-latest`, `POST /sessions/analyze-by-name/{name}`, `GET /sessions/artifacts/{file}` |
| Meditation | `POST /meditation/classify`, `POST /meditation/calibration/start`, `POST /meditation/calibration/save`, `GET /meditation/calibration/latest` |
| Practice | `POST /practice/lci`, `GET /practice/lci/history`, `GET /practice/recommend` |

No new backend endpoints were required — the existing v2 REST surface covered
every wired component.

## Athena-only

`git diff --name-only main...HEAD | xargs` sweep for
`MUSE_EEG_UUIDS|MUSE_S_UUID|ble_mgr|Muse[_ ]?S(...)` returns **no matches**.
Channel labels come from the live frame's `channel_names` (BrainFlow at runtime);
`getChannelLabel` falls back to `['TP9','AF7','AF8','TP10']` only before the first
frame arrives (documented in `src/lib/bandpower.js`).

## Colossus run

```bash
# Backend (repo root)
uvicorn neurolink_v2.app:app --host 0.0.0.0 --port 8008

# Frontend
cd frontend
cp .env.example .env    # or set VITE_API_BASE inline
npm install
npm run dev             # dev server
npm run build           # production build
npm run test:run        # vitest

# .env.example
# VITE_API_BASE=http://localhost:8008
```

Gates (all green on this branch): `pytest -q` → 532 passed ·
`npm --prefix frontend run test:run` → 10 passed · `npm --prefix frontend run build` → OK.

## Screenshots

_Placeholders — capture against a live Athena stream:_

- `docs/ports/img/practice-hero.png` — Practice tab, EA-1 halo breathing.
- `docs/ports/img/signal-bandtrend.png` — Signal tab band trend + contact quality.
- `docs/ports/img/journal-review.png` — Journal review with provenance card.
