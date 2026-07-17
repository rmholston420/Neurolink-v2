# Neurolink-v2

> Real-time EEG + fNIRS + optical biofeedback platform for the **Muse S Athena** headband.

## Tech Stack

| Layer | Technology |
|---|---|
| Device driver | BrainFlow 5.22+ (`BoardIds.MUSE_S_ATHENA_BOARD`) |
| Backend | Python 3.11 · FastAPI · asyncio · WebSocket |
| Signal processing | BrainFlow DataFilter · NumPy · SciPy |
| Frontend | React 18 + TypeScript · Vite · Chart.js / Recharts |
| Data persistence | SQLite (SQLAlchemy) |
| Config | Pydantic-settings · `.env` |
| Dev tooling | Docker Compose · Pytest · ESLint |

## Domains (slices)

```
neurolink_v2/
├── domain/
│   ├── device/          # BLE discovery, BrainFlow session lifecycle
│   ├── stream/          # async data pump, WebSocket broadcaster
│   ├── signal/          # band-power, artefact rejection, fNIRS
│   ├── session/         # recording start/stop, CSV/SQLite persistence
│   └── config/          # env + Pydantic settings
frontend/
│   ├── src/
│   │   ├── components/  # EEGChart, BandPower, StatusBar, DevicePanel
│   │   ├── hooks/       # useWebSocket, useEEGStream
│   │   └── pages/       # Dashboard, Sessions, Settings
infra/
│   ├── docker-compose.yml
│   └── Dockerfile
```

## Quickstart

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn neurolink_v2.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Muse S Athena: Key Specs

- **EEG**: 256 Hz · 14-bit · TP9, AF7, AF8, TP10 (+4 aux)
- **fNIRS**: 5-optode bilateral frontal · 64 Hz · 20-bit
- **PPG**: Triple-wavelength 850/730/660 nm · 64 Hz · 20-bit
- **IMU**: Accel + Gyro · 52 Hz · 16-bit
- **BLE**: 5.3 · Service UUID `0xFE8D`
- **BrainFlow board id**: `BoardIds.MUSE_S_ATHENA_BOARD`
- **Default preset**: `p1041` (8-ch EEG + 16-ch optics)

## License

MIT


## Neurolink-v2 live Athena scaffold

This repository now includes a domain-sliced scaffold for discovering a Muse Athena, starting a BrainFlow session, streaming live data over WebSocket, and rendering it in a React frontend.

### New areas
- `neurolink_v2/device_control/`
- `neurolink_v2/signal_pipeline/`
- `neurolink_v2/api_streaming/`
- `frontend/`
- `docs/`

### Ported DSP stack (`feature/v1-signal-port`)

Neurolink-v1's mature DSP pipeline is ported into `neurolink_v2/domain/signal/`:

- `domain/signal/dsp/` — Stages 1–6 (`pipeline.EEGPipeline`), band powers,
  artifact gate/detector, ASR, ocular/cardiac regression, bad-channel detection
  + spherical-spline interpolation, FAA/FMt, IMU, PPG, breathing, fNIRS.
- `domain/signal/stage0/` — `Stage0Guard` (impedance + IMU + environment gate).
- `domain/session/calibration.py` — `CalibrationController` runs the session-start
  resting baseline (30 s warmup discard → 150 s total) + Stage-0 readiness gate.

The live WebSocket EEG pump feeds each snapshot through `EEGPipeline`; pipeline
output and stream-health are attached to the outgoing frame additively. Poll
current stream quality with:

```bash
curl http://localhost:8008/api/stream/health
# -> { frames_total, frames_rejected, frames_clean, packet_loss_pct,
#      last_frame_ts, avg_tick_ms }
```

Run on Collosus (Kubuntu, Python 3.11):

```bash
uvicorn neurolink_v2.main:app --reload --port 8008
npm --prefix frontend run dev     # or: npm --prefix frontend run build
```
