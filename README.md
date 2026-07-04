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
