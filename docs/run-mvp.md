# Run the Neurolink-v2 MVP

## Backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn neurolink_v2.main:app --reload
```

## Frontend
```bash
cd frontend
npm install
npm run dev
```

## Browser workflow
1. Open the Vite frontend URL.
2. Click **Scan** to look for nearby Muse devices.
3. Click **Connect** to start the Muse Athena BrainFlow session.
4. Click **Start Stream** to begin backend broadcast pumping.
5. Confirm live EEG, optical, and IMU frames appear in the dashboard.

## Current notes
- The backend `connect` route currently uses `.env` BrainFlow settings or auto-discovery rather than a frontend-selected MAC address.
- The dashboard is an inspection console, not yet a charted signal viewer.
- Next iteration should add time-series charts, reconnect handling, and frontend-driven device targeting.
