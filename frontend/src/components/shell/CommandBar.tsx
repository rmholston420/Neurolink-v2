import React, { useState } from 'react'
import type { NeurolinkStore } from '../../hooks/useNeurolinkStore'
import { meditationApi } from '../../lib/apiClient'

export function CommandBar({ store }: { store: NeurolinkStore }) {
  const { deviceStatus, recording, streamStatus, startStream, stopStream, startRecording, stopRecording } = store
  const streaming = Boolean(deviceStatus?.is_streaming)
  // Start is only redundant once the *user* has requested the stream AND the
  // backend board confirms it. The backend can report is_streaming: true purely
  // as a side effect of /api/device/connect, so we must not disable Start on the
  // board state alone — otherwise the client-side stream can never be (re)started.
  const startDisabled = streamStatus === 'streaming' && streaming
  const [calibrating, setCalibrating] = useState(false)
  const [sessionLabel, setSessionLabel] = useState('')

  async function startCalibration() {
    setCalibrating(true)
    try {
      await meditationApi.startCalibration('Baseline', 120)
    } finally {
      setTimeout(() => setCalibrating(false), 1200)
    }
  }

  async function saveCalibration() {
    const b = store.meditation.bands
    await meditationApi.saveCalibration({
      label: sessionLabel || 'Baseline',
      alpha_base: b.alpha || 1, theta_base: b.theta || 1, beta_base: b.beta || 1,
      delta_base: b.delta || 1, gamma_base: b.gamma || 1, faa_base: store.meditation.faa || 0,
    })
  }

  return (
    <div className="nl-command">
      {/* Start stream drives the backend board pump (streamApi.start). The
          WebSocket opens separately on app mount (useNeurolinkWS), so the
          socket/health pills can be live even before this is clicked. */}
      <button className={`nl-btn ${startDisabled ? '' : 'nl-btn-primary'}`} onClick={startStream} disabled={startDisabled}>Start stream</button>
      <button className="nl-btn" onClick={stopStream} disabled={!streaming}>Stop stream</button>
      <span style={{ width: 1, height: 24, background: 'var(--stroke-veil)' }} />
      <button className={`nl-btn ${recording.recording ? 'nl-btn-danger' : ''}`} onClick={startRecording} disabled={recording.recording}>Start recording</button>
      <button className="nl-btn" onClick={stopRecording} disabled={!recording.recording}>Stop recording</button>
      <span style={{ width: 1, height: 24, background: 'var(--stroke-veil)' }} />
      <button className="nl-btn" onClick={startCalibration}>{calibrating ? 'Calibrating…' : 'Start calibration'}</button>
      <button className="nl-btn" onClick={saveCalibration}>Save calibration</button>
      <span className="nl-nav-spacer" style={{ flex: 1 }} />
      <input
        className="nl-btn"
        style={{ minWidth: 180, cursor: 'text' }}
        placeholder="Session label…"
        value={sessionLabel}
        onChange={(e) => setSessionLabel(e.target.value)}
        aria-label="Current session label"
      />
    </div>
  )
}
