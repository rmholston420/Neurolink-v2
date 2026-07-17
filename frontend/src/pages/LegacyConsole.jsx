import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MeditationPanel } from '../components/MeditationPanel.jsx'
import {
  flattenBandPowersForDisplay,
  getChannelLabel,
  getSignalGuidanceHint,
} from '../lib/bandpower.js'
import { card, detailChipBase, getStreamHealthStyle } from '../components/legacy/legacyStyles.js'
import { API_BASE, WS_URL } from '../lib/api.js'

export function LegacyConsole() {
  const [devices, setDevices] = useState([])
  const [deviceStatus, setDeviceStatus] = useState(null)
  const [streamStatus, setStreamStatus] = useState('idle')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [latest, setLatest] = useState({ eeg: null, optical: null, imu: null })
  const [events, setEvents] = useState([])
  const [recordingState, setRecordingState] = useState({ recording: false, path: '' })
  const [analysisState, setAnalysisState] = useState({ status: 'idle', summary: null, error: '', bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
  const [sessionHistory, setSessionHistory] = useState([])
  const [sessionHistoryStatus, setSessionHistoryStatus] = useState('idle')
  const [selectedSessionName, setSelectedSessionName] = useState('')
  const [selectedSessionSummary, setSelectedSessionSummary] = useState(null)
  const reviewSummary = selectedSessionSummary || analysisState.summary || {}
  const wsRef = useRef(null)
  const apiBase = useMemo(() => API_BASE, [])

  const flattenedBandPowers = useMemo(
    () => flattenBandPowersForDisplay(latest.eeg?.band_powers || {}),
    [latest]
  )

  const channelNames = useMemo(
    () => latest.eeg?.channel_names || deviceStatus?.channel_names || [],
    [latest, deviceStatus]
  )

  const meditationBands = useMemo(() => {
    const channels = Object.values(flattenedBandPowers)
    if (!channels.length) return {}
    const sums = { alpha: 0, theta: 0, beta: 0 }
    for (const bands of channels) {
      sums.alpha += Number(bands.alpha) || 0
      sums.theta += Number(bands.theta) || 0
      sums.beta += Number(bands.beta) || 0
    }
    return {
      alpha: sums.alpha / channels.length,
      theta: sums.theta / channels.length,
      beta: sums.beta / channels.length,
    }
  }, [flattenedBandPowers])

  const meditationFaa = latest.eeg?.pipeline?.faa ?? null

  const formatPrimaryChannel = (value) => {
    const numeric = Number(value)
    if (!Number.isInteger(numeric)) return value || 'n/a'
    return (
      (numeric > 0 ? channelNames?.[numeric - 1] : undefined) ??
      channelNames?.[numeric] ??
      value ??
      'n/a'
    )
  }

  const latestSessionSignalNote = useMemo(() => {
    const summary = analysisState.summary
    if (!summary) return null

    const alphaRatio = Number(summary.alpha_over_alpha_beta)
    const fastRatio = Number(summary.fast_over_total)
    const slowRatio = Number(summary.slow_over_total)

    if (Number.isFinite(fastRatio) && fastRatio >= 0.4) {
      return {
        title: 'Fast-band heavy',
        body: 'This session leans toward elevated beta/gamma activity, which can reflect muscle tension or movement during the recording.',
      }
    }
    if (Number.isFinite(alphaRatio) && alphaRatio >= 0.55) {
      return {
        title: 'Alpha-forward',
        body: 'This session shows relatively strong alpha compared with beta, which is often more consistent with calm, usable resting EEG.',
      }
    }
    if (Number.isFinite(slowRatio) && slowRatio >= 0.5) {
      return {
        title: 'Slow-band heavy',
        body: 'This session is weighted toward delta/theta activity, which can reflect drowsiness, eyes-closed relaxation, or low-arousal periods.',
      }
    }
    return {
      title: 'Mixed spectral profile',
      body: 'This session shows a mixed band distribution without one dominant pattern across the summary ratios.',
    }
  }, [analysisState.summary])

  function pushEvent(message) {
    setEvents((prev) => [new Date().toLocaleTimeString() + ' — ' + message, ...prev].slice(0, 10))
  }

  async function refreshStatus() {
    const r = await fetch(`${apiBase}/device/status`)
    const data = await r.json()
    setDeviceStatus(data)
    return data
  }

  async function scan() {
    const r = await fetch(`${apiBase}/device/scan`)
    const data = await r.json()
    setDevices(data.devices || [])
    if ((data.devices || []).length && !selectedAddress) {
      setSelectedAddress(data.devices[0].address)
    }
    pushEvent(`scan complete: ${data.count || 0} Muse candidate(s)`)
  }

  async function connect() {
    const r = await fetch(`${apiBase}/device/connect`, { method: 'POST' })
    const data = await r.json()
    await refreshStatus()
    pushEvent(`device ${data.status}`)
  }

  async function disconnectDevice() {
    const r = await fetch(`${apiBase}/device/disconnect`, { method: 'POST' })
    const data = await r.json()
    setStreamStatus('idle')
    await refreshStatus()
    pushEvent(`device ${data.status}`)
  }

  async function startStream() {
    const r = await fetch(`${apiBase}/stream/start`, { method: 'POST' })
    const data = await r.json()
    setStreamStatus(data.status || 'unknown')
    pushEvent(`stream ${data.status || 'unknown'}`)
  }

  async function stopStream() {
    const r = await fetch(`${apiBase}/stream/stop`, { method: 'POST' })
    const data = await r.json()
    setStreamStatus(data.status || 'stopped')
    pushEvent(`stream ${data.status || 'stopped'}`)
  }

  async function fetchRecordingState() {
    try {
      const r = await fetch(`${apiBase}/stream/recording`)
      const data = await r.json()
      setRecordingState({ recording: Boolean(data.recording), path: data.path || '' })
    } catch (error) {
      console.error('Failed to fetch recording state', error)
    }
  }

  async function loadSessionHistory() {
    try {
      setSessionHistoryStatus('loading')
      const r = await fetch(`${apiBase}/sessions/history/list`)
      const data = await r.json()
      if (data.status !== 'ok') {
        throw new Error(data.stderr || data.detail || 'Failed to load session history')
      }
      setSessionHistory(Array.isArray(data.sessions) ? data.sessions : [])
      setSessionHistoryStatus('ok')
    } catch (error) {
      console.error('Failed to load session history', error)
      setSessionHistory([])
      setSessionHistoryStatus('error')
      pushEvent('session history load failed')
    }
  }

  async function startRecording() {
    try {
      const r = await fetch(`${apiBase}/stream/recording/start`, { method: 'POST' })
      const data = await r.json()
      setRecordingState({ recording: Boolean(data.recording), path: data.path || '' })
      pushEvent(`recording ${data.recording ? 'started' : 'unchanged'}`)
    } catch (error) {
      console.error('Failed to start recording', error)
      pushEvent('recording start failed')
    }
  }

  async function stopRecording() {
    try {
      const r = await fetch(`${apiBase}/stream/recording/stop`, { method: 'POST' })
      const data = await r.json()
      setRecordingState({ recording: Boolean(data.recording), path: data.path || '' })
      pushEvent(`recording ${data.recording ? 'still running' : 'stopped'}`)
    } catch (error) {
      console.error('Failed to stop recording', error)
      pushEvent('recording stop failed')
    }
  }

  async function analyzeSessionByName(sessionName) {
    if (selectedSessionName === sessionName && analysisState.status === 'loading') {
      return
    }
    setSelectedSessionName(sessionName)
    setSelectedSessionSummary(null)
    setAnalysisState({ status: 'loading', summary: null, error: '', bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
    try {
      const r = await fetch(`${apiBase}/sessions/analyze-by-name/${encodeURIComponent(sessionName)}`, { method: 'POST' })
      const data = await r.json()
      if (data.status !== 'ok') {
        setAnalysisState({ status: 'error', summary: null, error: data.stderr || 'Analysis failed', bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
        pushEvent(`analysis failed for ${sessionName}`)
        return
      }
      setSelectedSessionSummary(data.summary || null)
      setAnalysisState({
        status: 'ok', summary: data.summary || null, error: '',
        bandsPng: data.bands_png || '', summaryCsv: data.summary_csv || '',
        timeseriesCsv: data.timeseries_csv || '', recordingMetadata: data.recording_metadata || null,
      })
      pushEvent(`analysis complete for ${sessionName}`)
      await fetchRecordingState()
      await loadSessionHistory()
    } catch (error) {
      console.error('Failed to analyze session by name', error)
      setAnalysisState({ status: 'error', summary: null, error: String(error), bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
      pushEvent(`analysis failed for ${sessionName}`)
    }
  }

  function viewSession(session) {
    setSelectedSessionName(session.session_name)
    setSelectedSessionSummary(session.summary || null)
    setAnalysisState((prev) => ({
      ...prev,
      status: session.summary ? 'ok' : prev.status,
      summary: session.summary || prev.summary,
      bandsPng: session.bands_png || prev.bandsPng || '',
      summaryCsv: session.summary_csv || prev.summaryCsv || '',
      timeseriesCsv: session.timeseries_csv || prev.timeseriesCsv || '',
      recordingMetadata: session.recording_metadata || prev.recordingMetadata || null,
    }))
  }

  async function analyzeLatestSession() {
    setAnalysisState({ status: 'loading', summary: null, error: '', bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
    try {
      const r = await fetch(`${apiBase}/sessions/analyze-latest`, { method: 'POST' })
      const data = await r.json()
      if (data.status !== 'ok') {
        setAnalysisState({ status: 'error', summary: null, error: data.stderr || 'Analysis failed', bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
        pushEvent('session analysis failed')
        return
      }
      setAnalysisState({
        status: 'ok', summary: data.summary || null, error: '',
        bandsPng: data.bands_png || '', summaryCsv: data.summary_csv || '',
        timeseriesCsv: data.timeseries_csv || '', recordingMetadata: data.recording_metadata || null,
      })
      pushEvent('session analysis complete')
      await fetchRecordingState()
      await loadSessionHistory()
    } catch (error) {
      console.error('Failed to analyze latest session', error)
      setAnalysisState({ status: 'error', summary: null, error: String(error), bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
      pushEvent('session analysis failed')
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => {})
    fetchRecordingState().catch(() => {})
    loadSessionHistory().catch(() => {})
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'ping') return
      if (msg.type === 'eeg') {
        setLatest((prev) => ({ ...prev, eeg: msg }))
      }
      if (msg.type === 'optical') setLatest((prev) => ({ ...prev, optical: msg }))
      if (msg.type === 'imu') setLatest((prev) => ({ ...prev, imu: msg }))
    }
    ws.onopen = () => pushEvent('websocket connected')
    ws.onclose = () => pushEvent('websocket disconnected')
    return () => ws.close()
  }, [])

  const eegChannels = latest.eeg?.channel_names || deviceStatus?.channel_names || []
  const eegSampleCount = latest.eeg?.ts?.length || latest.eeg?.timestamps?.length || 0
  const opticalSampleCount = latest.optical?.ts?.length || latest.optical?.timestamps?.length || 0
  const imuSampleCount = latest.imu?.ts?.length || latest.imu?.timestamps?.length || 0

  const bandPowers = flattenBandPowersForDisplay(latest.eeg?.band_powers || {})
  const bandDebug = latest.eeg?.band_debug || {}
  const battery =
    latest.eeg?.battery ??
    latest.optical?.battery ??
    latest.imu?.battery ??
    deviceStatus?.battery ??
    deviceStatus?.battery_level ??
    null

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto', color: '#e5eefc' }}>
      <h1 style={{ marginBottom: 8 }}>Neurolink-v2</h1>
      <p style={{ marginTop: 0, color: '#9eb0d1' }}>
        Domain-integrated Muse Athena console using the existing FastAPI device and stream routes.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <span style={detailChipBase}>
          <strong style={{ fontWeight: 600 }}>Device</strong>
          <span>{deviceStatus?.has_board ? 'connected' : 'not connected'}</span>
        </span>
        <span style={{ ...detailChipBase, background: getStreamHealthStyle(streamStatus).bg, border: `1px solid ${getStreamHealthStyle(streamStatus).border}`, color: getStreamHealthStyle(streamStatus).color }}>
          <strong style={{ fontWeight: 600 }}>Stream</strong>
          <span>{streamStatus}</span>
        </span>
        <span style={detailChipBase}>
          <strong style={{ fontWeight: 600 }}>Recording</strong>
          <span>{recordingState.recording ? 'active' : 'idle'}</span>
        </span>
        <span style={detailChipBase}>
          <strong style={{ fontWeight: 600 }}>Optical</strong>
          <span>{opticalSampleCount > 0 ? 'live' : 'no frames'}</span>
        </span>
        <span style={detailChipBase}>
          <strong style={{ fontWeight: 600 }}>IMU</strong>
          <span>{imuSampleCount > 0 ? 'live' : 'no frames'}</span>
        </span>
      </div>

      <MeditationPanel bands={meditationBands} faa={meditationFaa} />

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <button onClick={scan}>Scan</button>
        <button onClick={connect}>Connect</button>
        <button onClick={disconnectDevice}>Disconnect</button>
        <button onClick={startStream}>Start Stream</button>
        <button onClick={stopStream}>Stop Stream</button>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <h2>Device</h2>
          <p>Streaming: {String(deviceStatus?.is_streaming || false)}</p>
          <p>Has board: {String(deviceStatus?.has_board || false)}</p>
          <p>Preset: {deviceStatus?.preset || 'n/a'}</p>
          <p>Selected address: {selectedAddress || 'auto'}</p>
          <p style={{ marginTop: 6, color: '#9eb0d1', fontSize: 12 }}>
            {selectedAddress
              ? 'Connect will target the selected headset address.'
              : 'Auto will use the first discovered Athena address when available.'}
          </p>
        </div>
        <div style={card}>
          <h2>Live counts</h2>
          <p>EEG samples: {eegSampleCount}</p>
          <p>Optical samples: {opticalSampleCount}</p>
          <p>IMU samples: {imuSampleCount}</p>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ ...detailChipBase, background: getStreamHealthStyle(streamStatus).bg, border: `1px solid ${getStreamHealthStyle(streamStatus).border}`, color: getStreamHealthStyle(streamStatus).color }}>
              <strong style={{ fontWeight: 600 }}>Stream health</strong>
              <span>{streamStatus}</span>
            </span>
            <span style={detailChipBase}>
              <strong style={{ fontWeight: 600 }}>Optical</strong>
              <span>{opticalSampleCount > 0 ? 'live' : 'no frames'}</span>
            </span>
            <span style={detailChipBase}>
              <strong style={{ fontWeight: 600 }}>IMU</strong>
              <span>{imuSampleCount > 0 ? 'live' : 'no frames'}</span>
            </span>
          </div>
        </div>
        <div style={card}>
          <h2>EEG channels</h2>
          <p>{eegChannels.length ? eegChannels.join(', ') : 'No channels yet'}</p>
          <p>Stream state: {streamStatus}</p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16, marginTop: 16 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Battery</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 8px 0', color: '#e8eefc' }}>
            {battery == null ? '—' : `${Number(battery).toFixed(2)}%`}
          </p>
          <p style={{ margin: 0, color: '#9eb0d1' }}>Live board battery estimate from the current Athena stream.</p>
        </div>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Aux sensors</h2>
          <p style={{ marginTop: 0, color: '#9eb0d1' }}>Live optical and motion telemetry from the current Athena stream.</p>
          <p>Optical samples: {opticalSampleCount}</p>
          <p>IMU samples: {imuSampleCount}</p>
          <p style={{ marginTop: 6, color: '#9eb0d1', fontSize: 12 }}>
            Optical: {opticalSampleCount > 0 ? 'live' : 'no frames yet'}; IMU: {imuSampleCount > 0 ? 'live' : 'no frames yet'}.
          </p>
        </div>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Signal snapshot</h2>
          {Object.keys(bandPowers).length === 0 ? (
            <p>No band-power data yet</p>
          ) : (
            (() => {
              const firstChannelBands = Object.values(bandPowers)[0] || {}
              const delta = Number(firstChannelBands.delta ?? 0)
              const theta = Number(firstChannelBands.theta ?? 0)
              const alpha = Number(firstChannelBands.alpha ?? 0)
              const beta = Number(firstChannelBands.beta ?? 0)
              const gamma = Number(firstChannelBands.gamma ?? 0)
              const slow = delta + theta
              const fast = beta + gamma
              const alphaPlusBeta = alpha + beta
              const alphaRatio = alphaPlusBeta > 0 ? alpha / alphaPlusBeta : 0
              const thetaDeltaRatio = slow > 0 ? theta / slow : 0
              let profile = 'mixed'
              if (alphaRatio > 0.55) profile = 'alpha-dominant'
              else if (thetaDeltaRatio > 0.6) profile = 'theta-delta heavy'
              else if (fast > slow) profile = 'beta-gamma active'
              return (
                <div>
                  <p style={{ marginTop: 0, color: '#9eb0d1' }}>First EEG channel, normalized powers.</p>
                  <p>Profile: <strong>{profile}</strong></p>
                  <p>alpha / (alpha+beta): {alphaRatio.toFixed(3)}</p>
                  <p>theta / (delta+theta): {thetaDeltaRatio.toFixed(3)}</p>
                  <p>slow (δ+θ): {slow.toFixed(3)}</p>
                  <p>fast (β+γ): {fast.toFixed(3)}</p>
                </div>
              )
            })()
          )}
        </div>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Session status</h2>
          <p>Recording: <strong style={{ color: recordingState.recording ? '#34d399' : '#f59e0b' }}>{recordingState.recording ? 'active' : 'idle'}</strong></p>
          <p>Analysis: {analysisState.status}</p>
          <p style={{ color: '#9eb0d1', wordBreak: 'break-all', marginBottom: 0 }}>{recordingState.path || 'No active session file'}</p>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Diagnostics</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>Lower-priority raw telemetry for debugging and backend verification.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Band powers (raw)</h3>
              {Object.keys(bandPowers).length === 0 ? (
                <p>No band-power data yet</p>
              ) : (
                <div>
                  {Object.entries(bandPowers).map(([channel, bands]) => (
                    <div key={channel} style={{ marginBottom: 12 }}>
                      <strong>{getChannelLabel(channel, channelNames)}</strong>
                      <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                        {Object.entries(bands).map(([name, value]) => (
                          <li key={name}>{name}: {Number(value).toFixed(3)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Bandpower debug</h3>
              {Object.keys(bandDebug).length === 0 ? (
                <p>No debug data yet</p>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{JSON.stringify(bandDebug, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2>Session recording</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>
            Capture live EEG, optical, and IMU packets into a JSONL session file, then analyze the latest session.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <button onClick={startRecording}>Start recording</button>
            <button onClick={stopRecording}>Stop recording</button>
            <button onClick={analyzeLatestSession}>Analyze latest session</button>
          </div>
          <p>Status: <strong style={{ color: recordingState.recording ? '#34d399' : '#f59e0b' }}>{recordingState.recording ? 'Recording' : 'Idle'}</strong></p>
          <p style={{ color: '#9eb0d1', wordBreak: 'break-all' }}>File: {recordingState.path || 'No active session file'}</p>
          {analysisState.status === 'loading' && <p>Analyzing latest session…</p>}
          {analysisState.status === 'error' && <p style={{ color: '#f87171' }}>Analysis error: {analysisState.error}</p>}
          {analysisState.summary && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: '#0b1220', border: '1px solid rgba(158,176,209,0.18)' }}>
              <h3 style={{ marginTop: 0 }}>Latest analysis summary</h3>
              <p>Samples: {analysisState.summary.samples}</p>
              <p>Primary channel: {formatPrimaryChannel(analysisState.summary.primary_channel)}</p>
              <p>Duration (s): {analysisState.summary.duration_s}</p>
              <p>Mean alpha: {analysisState.summary.mean_alpha}</p>
              <p>Mean beta: {analysisState.summary.mean_beta}</p>
              <p>Alpha / (alpha + beta): {analysisState.summary.alpha_over_alpha_beta}</p>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Latest session review</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0, marginBottom: 6 }}>Review the most recent analyzed session without leaving the live console.</p>
          <p style={{ color: '#cbd5e1', marginTop: 0 }}>Reviewing: {selectedSessionName || 'latest analyzed session'}</p>

          {Object.keys(reviewSummary).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
                <h3 style={{ marginTop: 0 }}>Summary</h3>
                <p>Samples: {reviewSummary.samples || 'n/a'}</p>
                <p>Duration (s): {reviewSummary.duration_s || 'n/a'}</p>
                <p>Primary channel: {formatPrimaryChannel(reviewSummary.primary_channel)}</p>
                <p style={{ marginBottom: 0 }}>Alpha / (alpha + beta): {reviewSummary.alpha_over_alpha_beta || 'n/a'}</p>
              </div>
              <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
                <h3 style={{ marginTop: 0 }}>Recording context</h3>
                <p>Recording label: {reviewSummary.recording_label || 'n/a'}</p>
                <p>Metadata source: {{ manifest: 'persisted manifest', fallback: 'heuristic fallback', unknown: 'unknown' }[analysisState.recordingMetadata?.recording_metadata_source || 'unknown']}</p>
                <p>Duration (s): {analysisState.recordingMetadata?.duration_seconds ?? 'n/a'}</p>
                <p style={{ marginBottom: 0 }}>EEG packets: {analysisState.recordingMetadata?.eeg_packets ?? 'n/a'}</p>
              </div>
              <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
                <h3 style={{ marginTop: 0 }}>Band means</h3>
                <p>Mean alpha: {reviewSummary.mean_alpha || 'n/a'}</p>
                <p>Mean beta: {reviewSummary.mean_beta || 'n/a'}</p>
                <p style={{ color: '#9eb0d1', marginBottom: 0 }}>Values come from the analyzer summary CSV for the latest completed session.</p>
              </div>
              <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
                <h3 style={{ marginTop: 0 }}>Signal note</h3>
                <p style={{ color: '#9eb0d1', fontSize: 12, marginTop: 4, marginBottom: 6 }}>{latestSessionSignalNote?.title || 'Spectral summary'}</p>
                <p style={{ color: '#cbd5e1', marginBottom: reviewSummary.short_session ? 10 : 0 }}>
                  {getSignalGuidanceHint(reviewSummary) || latestSessionSignalNote?.body || 'Run a session analysis to generate a quick interpretation.'}
                </p>
                {reviewSummary.short_session && reviewSummary.short_session_caution && (
                  <div style={{ marginTop: 0, padding: '10px 12px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#fbbf24' }}>
                    {reviewSummary.short_session_caution}
                  </div>
                )}
              </div>
              <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
                <h3 style={{ marginTop: 0 }}>Artifacts</h3>
                {analysisState.bandsPng ? (
                  <p><a href={`${apiBase}/sessions/artifacts/${analysisState.bandsPng.split('/').pop()}`} target="_blank" rel="noreferrer">Open band chart PNG</a></p>
                ) : (<p>No band chart artifact yet</p>)}
                {analysisState.summaryCsv ? (
                  <p><a href={`${apiBase}/sessions/artifacts/${analysisState.summaryCsv.split('/').pop()}`} target="_blank" rel="noreferrer">Download summary CSV</a></p>
                ) : (<p>No summary CSV yet</p>)}
                {analysisState.timeseriesCsv ? (
                  <p style={{ marginBottom: 0 }}><a href={`${apiBase}/sessions/artifacts/${analysisState.timeseriesCsv.split('/').pop()}`} target="_blank" rel="noreferrer">Download time series CSV</a></p>
                ) : (<p style={{ marginBottom: 0 }}>No time series CSV yet</p>)}
              </div>
            </div>
          ) : (
            <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12, color: '#9eb0d1' }}>
              Analyze a recorded session to populate review stats and artifact links here.
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Session history</h2>
              <p style={{ color: '#9eb0d1', marginTop: 0, marginBottom: 0 }}>Recorded sessions with analysis status and artifact access.</p>
            </div>
            <button onClick={loadSessionHistory}>Refresh history</button>
          </div>

          {sessionHistoryStatus === 'loading' && (
            <div style={{ color: '#9eb0d1', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>Loading session history…</p>
              <p style={{ margin: '4px 0 0' }}>Checking recorded sessions and review artifacts.</p>
            </div>
          )}
          {sessionHistoryStatus === 'error' && <p style={{ color: '#f87171' }}>Could not load session history.</p>}

          {sessionHistoryStatus !== 'loading' && sessionHistory.length === 0 ? (
            <div style={{ color: '#9eb0d1', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>No recorded sessions found yet.</p>
              <p style={{ margin: '4px 0 0' }}>Start a recording, then stop it to create a reviewable session.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {sessionHistory.map((session) => (
                <div key={session.session_name} style={{ background: selectedSessionName === session.session_name ? 'rgba(30,41,59,0.95)' : '#0b1220', border: selectedSessionName === session.session_name ? '1px solid rgba(96,165,250,0.7)' : '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#e8eefc', fontWeight: 700 }}>{session.session_name}</div>
                      <div style={{ color: '#9eb0d1', fontSize: 12 }}>{session.timestamp}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: session.analyzed ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)', border: session.analyzed ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(245,158,11,0.35)', color: session.analyzed ? '#86efac' : '#fcd34d' }}>
                        {session.analyzed ? 'Analyzed' : 'Recorded only'}
                      </div>
                      {selectedSessionName === session.session_name ? (
                        <div style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.35)', color: '#bfdbfe' }}>Reviewing</div>
                      ) : null}
                      {session.recording_label === 'short' ? (
                        <div style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>Short recording</div>
                      ) : null}
                      {session.recording_metadata?.recording_metadata_source === 'fallback' ? (
                        <div style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.28)', color: '#cbd5e1' }} title="Session metadata reconstructed heuristically from legacy session data">Metadata: heuristic</div>
                      ) : null}
                    </div>
                  </div>

                  {session.recording_metadata ? (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(96,165,250,0.16)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span style={detailChipBase}>Duration: {session.recording_metadata.duration_seconds ?? 'n/a'} s</span>
                        <span style={detailChipBase}>EEG packets: {session.recording_metadata.eeg_packets ?? 'n/a'}</span>
                        {session.recording_metadata.recording_metadata_source === 'fallback' ? (
                          <span style={{ ...detailChipBase, background: 'rgba(148,163,184,0.14)', border: '1px solid rgba(148,163,184,0.28)' }} title="Session metadata reconstructed heuristically from legacy session data">Metadata: heuristic fallback</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {session.summary ? (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(158,176,209,0.08)', border: '1px solid rgba(158,176,209,0.12)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span style={detailChipBase}>Primary: {formatPrimaryChannel(session.summary.primary_channel)}</span>
                        <span style={detailChipBase}>Alpha/(alpha+beta): {session.summary.alpha_over_alpha_beta ?? 'n/a'}</span>
                        <span style={detailChipBase}>Fast/total: {session.summary.fast_over_total ?? 'n/a'}</span>
                        <span style={detailChipBase}>Slow/total: {session.summary.slow_over_total ?? 'n/a'}</span>
                      </div>
                      {session.summary.guidance_hint ? (
                        <div style={{ color: '#9eb0d1', marginTop: 8, fontSize: 12 }}>Note: {session.summary.guidance_hint}</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                    {session.analyzed ? (
                      <>
                        <button onClick={() => viewSession(session)} disabled={selectedSessionName === session.session_name}>
                          {selectedSessionName === session.session_name ? 'In review' : 'Open review'}
                        </button>
                        <button onClick={() => analyzeSessionByName(session.session_name)} disabled={selectedSessionName === session.session_name && analysisState.status === 'loading'}>
                          {selectedSessionName === session.session_name && analysisState.status === 'loading' ? 'Reanalyzing…' : 'Reanalyze'}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => analyzeSessionByName(session.session_name)}>Analyze</button>
                    )}

                    {(session.bands_png || session.summary_csv || session.timeseries_csv) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ ...detailChipBase, color: '#9eb0d1', background: 'rgba(158,176,209,0.08)', border: '1px solid rgba(158,176,209,0.18)' }}>Artifacts</span>
                        {session.bands_png && (<a href={`${apiBase}/sessions/artifacts/${session.bands_png.split('/').pop()}`} target="_blank" rel="noreferrer" style={detailChipBase}>Band chart</a>)}
                        {session.summary_csv && (<a href={`${apiBase}/sessions/artifacts/${session.summary_csv.split('/').pop()}`} target="_blank" rel="noreferrer" style={detailChipBase}>Summary CSV</a>)}
                        {session.timeseries_csv && (<a href={`${apiBase}/sessions/artifacts/${session.timeseries_csv.split('/').pop()}`} target="_blank" rel="noreferrer" style={detailChipBase}>Time series CSV</a>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={card}>
          <h2>Telemetry</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>Secondary transport and sensor inspection for development, validation, and troubleshooting.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(devices, null, 2)}</pre>
        </div>
        <div style={card}>
          <h3>Recent events</h3>
          <ul>{events.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginTop: 16 }}>
        <div style={card}>
          <h3>Latest optical frame</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(latest.optical, null, 2)}</pre>
        </div>
        <div style={card}>
          <h3>Latest IMU frame</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(latest.imu, null, 2)}</pre>
        </div>
      </section>
    </main>
  )
}
