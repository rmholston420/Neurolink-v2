# Neurolink-v2 Architecture

## Domain slices
- device_control: BLE scan, BrainFlow session lifecycle, hardware diagnostics.
- signal_pipeline: typed frames, buffers, transforms, metrics.
- api_streaming: FastAPI control plane and WebSocket live stream.
- frontend: React dashboard for discovery, connection, and live inspection.

## MVP flow
1. Scan nearby Muse devices.
2. Start Athena session through BrainFlow.
3. Poll EEG, IMU, and ancillary presets.
4. Broadcast latest frames to the browser over WebSocket.
