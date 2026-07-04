import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

const card = {
  background: '#131c31',
  padding: 16,
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
}

const BAND_COLORS = {
  delta: '#7dd3fc',
  theta: '#a78bfa',
  alpha: '#34d399',
  beta: '#f59e0b',
  gamma: '#f87171',
}

const HISTORY_LIMIT = 60
const BAND_NAMES = ['delta', 'theta', 'alpha', 'beta', 'gamma']

const QUALITY_STYLES = {
  good: { label: 'good', bg: 'rgba(52, 211, 153, 0.16)', border: 'rgba(52, 211, 153, 0.45)', color: '#86efac' },
  warn: { label: 'warn', bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.45)', color: '#fcd34d' },
  'artifact-likely': { label: 'artifact-likely', bg: 'rgba(248, 113, 113, 0.16)', border: 'rgba(248, 113, 113, 0.45)', color: '#fca5a5' },
  flat: { label: 'flat', bg: 'rgba(148, 163, 184, 0.16)', border: 'rgba(148, 163, 184, 0.45)', color: '#cbd5e1' },
  'insufficient-window': { label: 'insufficient-window', bg: 'rgba(96, 165, 250, 0.16)', border: 'rgba(96, 165, 250, 0.45)', color: '#93c5fd' },
  unknown: { label: 'unknown', bg: 'rgba(148, 163, 184, 0.16)', border: 'rgba(148, 163, 184, 0.45)', color: '#cbd5e1' },
}

function normalizeBandEntry(entry) {
  if (!entry || typeof entry !== 'object') return null

  const directHasBands = BAND_NAMES.some((name) => entry[name] != null)
  if (directHasBands) {
    const normalized = {}
    for (const name of BAND_NAMES) normalized[name] = clamp01(entry[name] ?? 0)
    return normalized
  }

  for (const value of Object.values(entry)) {
    if (value && typeof value === 'object') {
      const nestedHasBands = BAND_NAMES.some((name) => value[name] != null)
      if (nestedHasBands) {
        const normalized = {}
        for (const name of BAND_NAMES) normalized[name] = clamp01(value[name] ?? 0)
        return normalized
      }
    }
  }

  return null
}

function flattenBandPowersForDisplay(bandPowers) {
  if (!bandPowers || typeof bandPowers !== 'object') return {}
  const result = {}
  for (const [channel, value] of Object.entries(bandPowers)) {
    const normalized = normalizeBandEntry(value)
    if (normalized) result[channel] = normalized
  }
  return result
}

function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function buildBandSeries(history, bandName) {
  return history.map((entry, index) => ({
    x: index,
    y: clamp01(entry?.[bandName] ?? 0),
  }))
}

function getChartRange(history, bandNames) {
  const values = []
  for (const entry of history) {
    for (const bandName of bandNames) {
      const value = Number(entry?.[bandName])
      if (Number.isFinite(value)) values.push(clamp01(value))
    }
  }

  if (!values.length) {
    return { min: 0, max: 1 }
  }

  let min = Math.min(...values)
  let max = Math.max(...values)

  if (min === max) {
    const pad = Math.max(0.02, min * 0.2 || 0.02)
    min = Math.max(0, min - pad)
    max = Math.min(1, max + pad)
  } else {
    const pad = Math.max(0.02, (max - min) * 0.2)
    min = Math.max(0, min - pad)
    max = Math.min(1, max + pad)
  }

  if (max <= min) {
    return { min: 0, max: 1 }
  }

  return { min, max }
}

function makePath(points, width, height, minY, maxY) {
  if (!points.length) return ''
  const maxX = Math.max(points.length - 1, 1)
  const range = Math.max(maxY - minY, 0.0001)

  return points
    .map((point, index) => {
      const x = (point.x / maxX) * width
      const normalizedY = (point.y - minY) / range
      const y = height - normalizedY * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function QualityBadge({ quality }) {
  const status = quality?.status || 'unknown'
  const reason = quality?.reason || 'No classification yet'
  const style = QUALITY_STYLES[status] || QUALITY_STYLES.unknown

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: 12,
        fontWeight: 700,
      }}
      title={reason}
    >
      <span>{style.label}</span>
    </div>
  )
}

function BandTrendCard({ bandName, history }) {
  const width = 180
  const height = 56
  const points = buildBandSeries(history, bandName)
  const { min, max } = getChartRange(history, [bandName])
  const d = makePath(points, width, height, min, max)
  const latest = history.length ? clamp01(history[history.length - 1]?.[bandName] ?? 0) : 0
  const earlierIndex = history.length > 6 ? history.length - 6 : 0
  const earlier = history.length ? clamp01(history[earlierIndex]?.[bandName] ?? 0) : 0
  const delta = latest - earlier
  const trend = delta > 0.02 ? 'rising' : delta < -0.02 ? 'falling' : 'steady'

  return (
    <div
      style={{
        background: '#0b1220',
        border: '1px solid rgba(158,176,209,0.14)',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ color: '#c9d7f2', textTransform: 'capitalize', fontWeight: 600 }}>{bandName}</span>
        <span style={{ color: BAND_COLORS[bandName], fontVariantNumeric: 'tabular-nums' }}>{latest.toFixed(3)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <path
          d={d}
          fill="none"
          stroke={BAND_COLORS[bandName]}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#9eb0d1', fontSize: 12 }}>
        <span>{trend}</span>
        <span>{min.toFixed(3)}–{max.toFixed(3)}</span>
      </div>
    </div>
  )
}

function BandPowerChart({ history, selectedBand, onSelectBand }) {
  const width = 520
  const height = 220
  const bandNames = BAND_NAMES
  const latestEntry = history[history.length - 1] || null

  if (!history.length) {
    return <p>No band-power history yet</p>
  }

  const focusBand = bandNames.includes(selectedBand) ? selectedBand : 'alpha'
  const { min, max } = getChartRange(history, [focusBand])

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          background: '#0b1220',
          borderRadius: 10,
          border: '1px solid rgba(158,176,209,0.18)',
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((level) => {
          const y = level * height
          return (
            <line
              key={level}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="rgba(158,176,209,0.14)"
              strokeWidth="1"
            />
          )
        })}

        {bandNames.map((bandName) => {
          const points = buildBandSeries(history, bandName)
          const d = makePath(points, width, height, min, max)
          const isFocused = bandName === focusBand
          return (
            <path
              key={bandName}
              d={d}
              fill="none"
              stroke={BAND_COLORS[bandName]}
              strokeWidth={isFocused ? '3.5' : '1.25'}
              strokeOpacity={isFocused ? '1' : '0.18'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        <text x="8" y="18" fill="#9eb0d1" fontSize="12">
          max {max.toFixed(3)}
        </text>
        <text x="8" y={height - 8} fill="#9eb0d1" fontSize="12">
          min {min.toFixed(3)}
        </text>
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {bandNames.map((bandName) => {
          const isFocused = bandName === focusBand
          return (
            <button
              key={bandName}
              onClick={() => onSelectBand(bandName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 999,
                border: isFocused ? `1px solid ${BAND_COLORS[bandName]}` : '1px solid rgba(158,176,209,0.18)',
                background: isFocused ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: '#c9d7f2',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: BAND_COLORS[bandName],
                  display: 'inline-block',
                }}
              />
              <span>
                {bandName}
                {latestEntry ? `: ${clamp01(latestEntry?.[bandName] ?? 0).toFixed(3)}` : ''}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const [devices, setDevices] = useState([])
  const [deviceStatus, setDeviceStatus] = useState(null)
  const [streamStatus, setStreamStatus] = useState('idle')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [latest, setLatest] = useState({ eeg: null, optical: null, imu: null })
  const [events, setEvents] = useState([])
  const [bandHistory, setBandHistory] = useState([])
  const [recordingState, setRecordingState] = useState({ recording: false, path: '' })
  const [analysisState, setAnalysisState] = useState({ status: 'idle', summary: null, error: '', bandsPng: '', summaryCsv: '', timeseriesCsv: '' })
  const [selectedBand, setSelectedBand] = useState('alpha')
  const wsRef = useRef(null)
  const apiBase = useMemo(() => 'http://localhost:8008/api', [])

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
      setRecordingState({
        recording: Boolean(data.recording),
        path: data.path || '',
      })
    } catch (error) {
      console.error('Failed to fetch recording state', error)
    }
  }

  async function startRecording() {
    try {
      const r = await fetch(`${apiBase}/stream/recording/start`, { method: 'POST' })
      const data = await r.json()
      setRecordingState({
        recording: Boolean(data.recording),
        path: data.path || '',
      })
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
      setRecordingState({
        recording: Boolean(data.recording),
        path: data.path || '',
      })
      pushEvent(`recording ${data.recording ? 'still running' : 'stopped'}`)
    } catch (error) {
      console.error('Failed to stop recording', error)
      pushEvent('recording stop failed')
    }
  }

  async function analyzeLatestSession() {
    setAnalysisState({ status: 'loading', summary: null, error: '' })
    try {
      const r = await fetch(`${apiBase}/sessions/analyze-latest`, { method: 'POST' })
      const data = await r.json()
      if (data.status !== 'ok') {
        setAnalysisState({
          status: 'error',
          summary: null,
          error: data.stderr || 'Analysis failed',
          bandsPng: '',
          summaryCsv: '',
          timeseriesCsv: '',
        })
        pushEvent('session analysis failed')
        return
      }
      setAnalysisState({
        status: 'ok',
        summary: data.summary || null,
        error: '',
        bandsPng: data.bands_png || '',
        summaryCsv: data.summary_csv || '',
        timeseriesCsv: data.timeseries_csv || '',
      })
      pushEvent('session analysis complete')
      await fetchRecordingState()
    } catch (error) {
      console.error('Failed to analyze latest session', error)
      setAnalysisState({
        status: 'error',
        summary: null,
        error: String(error),
        bandsPng: '',
        summaryCsv: '',
        timeseriesCsv: '',
      })
      pushEvent('session analysis failed')
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => {})
    fetchRecordingState().catch(() => {})
    const ws = new WebSocket('ws://localhost:8008/api/stream/ws')
    wsRef.current = ws
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'ping') return
      if (msg.type === 'eeg') {
        setLatest((prev) => ({ ...prev, eeg: msg }))

        const bandPowers = flattenBandPowersForDisplay(msg?.band_powers || {})
        const firstChannelBands = Object.values(bandPowers)[0]
        if (firstChannelBands) {
          setBandHistory((prev) => [...prev, firstChannelBands].slice(-HISTORY_LIMIT))
        }
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
  const bandQuality = latest.eeg?.band_quality || {}
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
        </div>
        <div style={card}>
          <h2>Live counts</h2>
          <p>EEG samples: {eegSampleCount}</p>
          <p>Optical samples: {opticalSampleCount}</p>
          <p>IMU samples: {imuSampleCount}</p>
        </div>
        <div style={card}>
          <h2>EEG channels</h2>
          <p>{eegChannels.length ? eegChannels.join(', ') : 'No channels yet'}</p>
          <p>Stream state: {streamStatus}</p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <h2>Battery</h2>
          <p>{battery == null ? 'No battery data yet' : `${battery}`}</p>
        </div>
        <div style={card}>
          <h2>Band powers</h2>
          {Object.keys(bandPowers).length === 0 ? (
            <p>No band-power data yet</p>
          ) : (
            <div>
              {Object.entries(bandPowers).map(([channel, bands]) => (
                <div key={channel} style={{ marginBottom: 12 }}>
                  <strong>{channel}</strong>
                  <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                    {Object.entries(bands).map(([name, value]) => (
                      <li key={name}>{name}: {value}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={card}>
          <h2>Session metrics</h2>
          {Object.keys(bandPowers).length === 0 ? (
            <p>No metrics yet</p>
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
              else if (thetaDeltaRatio > 0.6) profile = 'theta–delta heavy'
              else if (fast > slow) profile = 'beta–gamma active'

              return (
                <div>
                  <p style={{ marginTop: 0, color: '#9eb0d1' }}>First EEG channel, normalized powers.</p>
                  <p>Profile: {profile}</p>
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
          <h2>Signal quality</h2>
          {Object.keys(bandQuality).length === 0 ? (
            <p>No quality data yet</p>
          ) : (
            <div>
              {Object.entries(bandQuality).map(([channel, quality]) => (
                <div key={channel} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <strong>{channel}</strong>
                    <QualityBadge quality={quality} />
                  </div>
                  <p style={{ margin: 0, color: '#9eb0d1', fontSize: 12 }}>
                    {quality?.reason || 'No reason available'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <h2>Bandpower debug</h2>
          {Object.keys(bandDebug).length === 0 ? (
            <p>No debug data yet</p>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {JSON.stringify(bandDebug, null, 2)}
            </pre>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2>Rolling EEG band-power chart</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>
            Live normalized history from the first available EEG channel, last {HISTORY_LIMIT} updates. Click a band chip to focus it.
          </p>
          <BandPowerChart history={bandHistory} selectedBand={selectedBand} onSelectBand={setSelectedBand} />
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2>Alpha neurofeedback</h2>
          {Object.keys(bandPowers).length === 0 ? (
            <p>No band-power data yet</p>
          ) : (
            (() => {
              const firstChannelBands = Object.values(bandPowers)[0] || {}
              const alpha = Number(firstChannelBands.alpha ?? 0)
              const beta = Number(firstChannelBands.beta ?? 0)
              const alphaPlusBeta = alpha + beta
              const ratio = alphaPlusBeta > 0 ? Math.max(0, Math.min(1, alpha / alphaPlusBeta)) : 0

              let cue = 'neutral'
              if (ratio > 0.7) cue = 'high alpha (relaxed)'
              else if (ratio > 0.5) cue = 'moderate alpha'
              else if (ratio > 0.3) cue = 'low alpha'
              else cue = 'beta-dominant'

              const barHeight = 120
              const filledHeight = barHeight * ratio

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div
                    style={{
                      width: 32,
                      height: barHeight,
                      borderRadius: 999,
                      border: '1px solid rgba(158,176,209,0.3)',
                      background: '#0b1220',
                      display: 'flex',
                      alignItems: 'flex-end',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: filledHeight,
                        background: 'linear-gradient(to top, #34d399, #a78bfa)',
                      }}
                    />
                  </div>
                  <div>
                    <p style={{ marginTop: 0, color: '#9eb0d1' }}>
                      alpha / (alpha+beta): {ratio.toFixed(3)}
                    </p>
                    <p>{cue}</p>
                    <p style={{ color: '#9eb0d1' }}>
                      First EEG channel, normalized powers from current band snapshot.
                    </p>
                  </div>
                </div>
              )
            })()
          )}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2>Band trend cards</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>
            Compact live trends for the last {HISTORY_LIMIT} band-power updates.
          </p>
          {bandHistory.length === 0 ? (
            <p>No band-power history yet</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              {BAND_NAMES.map((bandName) => (
                <BandTrendCard key={bandName} bandName={bandName} history={bandHistory} />
              ))}
            </div>
          )}
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
          <p>
            Status:{' '}
            <strong style={{ color: recordingState.recording ? '#34d399' : '#f59e0b' }}>
              {recordingState.recording ? 'Recording' : 'Idle'}
            </strong>
          </p>
          <p style={{ color: '#9eb0d1', wordBreak: 'break-all' }}>
            File: {recordingState.path || 'No active session file'}
          </p>
          {analysisState.status === 'loading' && <p>Analyzing latest session…</p>}
          {analysisState.status === 'error' && (
            <p style={{ color: '#f87171' }}>Analysis error: {analysisState.error}</p>
          )}
          {analysisState.summary && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: '#0b1220',
                border: '1px solid rgba(158,176,209,0.18)',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Latest analysis summary</h3>
              <p>Samples: {analysisState.summary.samples}</p>
              <p>Primary channel: {analysisState.summary.primary_channel || 'n/a'}</p>
              <p>Duration (s): {analysisState.summary.duration_s}</p>
              <p>Mean alpha: {analysisState.summary.mean_alpha}</p>
              <p>Mean beta: {analysisState.summary.mean_beta}</p>
              <p>Alpha / (alpha + beta): {analysisState.summary.alpha_over_alpha_beta}</p>
              {analysisState.bandsPng && (
                <p>
                  <a
                    href={`http://localhost:8008/api/sessions/artifacts/${analysisState.bandsPng.split('/').pop()}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open latest band chart
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={card}>
          <h2>Discovered Muse devices</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(devices, null, 2)}</pre>
        </div>
        <div style={card}>
          <h2>Recent events</h2>
          <ul>
            {events.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={card}>
          <h2>Latest optical frame</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(latest.optical, null, 2)}</pre>
        </div>
        <div style={card}>
          <h2>Latest IMU frame</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(latest.imu, null, 2)}</pre>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
