import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

const card = {
  background: '#131c31',
  padding: 16,
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
}

const detailChipBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 9px',
  borderRadius: 999,
  fontSize: 12,
  lineHeight: 1.2,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,0.12)',
  border: '1px solid rgba(148,163,184,0.22)',
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



function getSignalGuidanceHint(summary) {
  if (summary?.guidance_hint && String(summary.guidance_hint).trim()) {
    return summary.guidance_hint;
  }
  return "Mixed spectral profile; focus on comfort, breathing, and headset seating.";
}

function getChannelLabel(channelKey, channelNames = []) {
  const key = String(channelKey ?? '')
  const numeric = Number(key)

  if (Array.isArray(channelNames) && Number.isInteger(numeric) && numeric >= 0 && numeric < channelNames.length) {
    return channelNames[numeric] || key
  }

  if (Array.isArray(channelNames)) {
    const direct = channelNames.find((name) => String(name) === key)
    if (direct) return direct
  }

  const fallback = {
    '0': 'TP9',
    '1': 'AF7',
    '2': 'AF8',
    '3': 'TP10',
  }

  return fallback[key] || key
}

function formatQualityLabel(status) {
  if (!status) return 'unknown'
  return String(status).replaceAll('-', ' ')
}

function OperatorChannelCard({ channelKey, channelNames, bands, quality }) {
  const numericKey = Number(channelKey)
  const label =
    Number.isInteger(numericKey)
      ? (numericKey > 0 ? channelNames?.[numericKey - 1] : undefined) ??
        channelNames?.[numericKey] ??
        `Channel ${channelKey}`
      : channelNames?.[channelKey] ?? `Channel ${channelKey}`
  const qualityStatus = quality?.status || 'unknown'
  const qualityReason = quality?.reason || 'No classification yet'
  const qualityGuidance = quality?.guidance || ''
  const style = QUALITY_STYLES[qualityStatus] || QUALITY_STYLES.unknown

  return (
    <div
      style={{
        background: '#0b1220',
        border: '1px solid rgba(158,176,209,0.14)',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ color: '#e8eefc', fontWeight: 700 }}>{label}</div>
          <div style={{ color: '#9eb0d1', fontSize: 12 }}>channel {String(channelKey)}</div>
        </div>
        <div
          title={qualityReason}
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
            textTransform: 'capitalize',
          }}
        >
          {formatQualityLabel(qualityStatus)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 8 }}>
        {BAND_NAMES.map((bandName) => (
          <div
            key={bandName}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(158,176,209,0.10)',
              borderRadius: 10,
              padding: 8,
            }}
          >
            <div style={{ color: BAND_COLORS[bandName], fontSize: 12, textTransform: 'capitalize', marginBottom: 4 }}>
              {bandName}
            </div>
            <div style={{ color: '#e8eefc', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {clamp01(bands?.[bandName] ?? 0).toFixed(3)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, color: '#9eb0d1', fontSize: 12 }}>
        <div><span style={{ color: '#c9d7f2' }}>Reason:</span> {qualityReason}</div>
        {qualityGuidance ? (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(158,176,209,0.12)',
              color: '#dbe7ff',
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: '#9eb0d1', display: 'block', marginBottom: 4 }}>Operator guidance</span>
            {qualityGuidance}
          </div>
        ) : null}
      </div>
    </div>
  )
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

export function App() {
  const [devices, setDevices] = useState([])
  const [deviceStatus, setDeviceStatus] = useState(null)
  const [streamStatus, setStreamStatus] = useState('idle')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [latest, setLatest] = useState({ eeg: null, optical: null, imu: null })
  const [events, setEvents] = useState([])
  const [bandHistory, setBandHistory] = useState([])
  const [recordingState, setRecordingState] = useState({ recording: false, path: '' })
  const [analysisState, setAnalysisState] = useState({ status: 'idle', summary: null, error: '', bandsPng: '', summaryCsv: '', timeseriesCsv: '', recordingMetadata: null })
  const [sessionHistory, setSessionHistory] = useState([])
  const [sessionHistoryStatus, setSessionHistoryStatus] = useState('idle')
  const [selectedSessionName, setSelectedSessionName] = useState('')
  const [selectedSessionSummary, setSelectedSessionSummary] = useState(null)
  const [selectedBand, setSelectedBand] = useState('alpha')
  const reviewSummary = selectedSessionSummary || analysisState.summary || {}
  const wsRef = useRef(null)
  const apiBase = useMemo(() => 'http://localhost:8008/api', [])

  const flattenedBandPowers = useMemo(
    () => flattenBandPowersForDisplay(latest.eeg?.band_powers || {}),
    [latest]
  )

  const channelNames = useMemo(
    () => latest.eeg?.channel_names || deviceStatus?.channel_names || [],
    [latest, deviceStatus]
  )

  const qualityByChannel = useMemo(
    () => latest.eeg?.band_quality || {},
    [latest]
  )

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



  const operatorChannelsSection = Object.keys(flattenedBandPowers).length ? (
    <div style={card}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>Athena channels</h2>
      <p style={{ color: '#9eb0d1', marginTop: 0, marginBottom: 12 }}>
        Live per-channel normalized bands with operator-readable signal status.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {Object.entries(flattenedBandPowers).map(([channelKey, bands]) => (
          <OperatorChannelCard
            key={channelKey}
            channelKey={channelKey}
            channelNames={channelNames}
            bands={bands}
            quality={qualityByChannel?.[channelKey]}
          />
        ))}
      </div>
    </div>
  ) : null

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

  async function analyzeSessionByName(sessionName) {
    if (selectedSessionName === sessionName && analysisState.status === 'loading') {
      return
    }
    setSelectedSessionName(sessionName)
  setSelectedSessionSummary(null)
    setAnalysisState({
      status: 'loading',
      summary: null,
      error: '',
      bandsPng: '',
      summaryCsv: '',
      timeseriesCsv: '',
      recordingMetadata: null,
    })
    try {
      const r = await fetch(`${apiBase}/sessions/analyze-by-name/${encodeURIComponent(sessionName)}`, {
        method: 'POST',
      })
      const data = await r.json()
      if (data.status !== 'ok') {
        setAnalysisState({
          status: 'error',
          summary: null,
          error: data.stderr || 'Analysis failed',
          bandsPng: '',
          summaryCsv: '',
          timeseriesCsv: '',
          recordingMetadata: null,
        })
        pushEvent(`analysis failed for ${sessionName}`)
        return
      }

      setSelectedSessionSummary(data.summary || null)
      setAnalysisState({
        status: 'ok',
        summary: data.summary || null,
        error: '',
        bandsPng: data.bands_png || '',
        summaryCsv: data.summary_csv || '',
        timeseriesCsv: data.timeseries_csv || '',
        recordingMetadata: data.recording_metadata || null,
      })
      pushEvent(`analysis complete for ${sessionName}`)
      await fetchRecordingState()
      await loadSessionHistory()
    } catch (error) {
      console.error('Failed to analyze session by name', error)
      setAnalysisState({
        status: 'error',
        summary: null,
        error: String(error),
        bandsPng: '',
        summaryCsv: '',
        timeseriesCsv: '',
        recordingMetadata: null,
      })
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
    setAnalysisState({
      status: 'loading',
      summary: null,
      error: '',
      bandsPng: '',
      summaryCsv: '',
      timeseriesCsv: '',
      recordingMetadata: null,
    })
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
          recordingMetadata: null,
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
        recordingMetadata: data.recording_metadata || null,
      })
      pushEvent('session analysis complete')
      await fetchRecordingState()
      await loadSessionHistory()
    } catch (error) {
      console.error('Failed to analyze latest session', error)
      setAnalysisState({
        status: 'error',
        summary: null,
        error: String(error),
        bandsPng: '',
        summaryCsv: '',
        timeseriesCsv: '',
        recordingMetadata: null,
      })
      pushEvent('session analysis failed')
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => {})
    fetchRecordingState().catch(() => {})
    loadSessionHistory().catch(() => {})
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

      {operatorChannelsSection}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Battery</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 8px 0', color: '#e8eefc' }}>
            {battery == null ? '—' : `${Number(battery).toFixed(2)}%`}
          </p>
          <p style={{ margin: 0, color: '#9eb0d1' }}>
            Live board battery estimate from the current Athena stream.
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
          <h2 style={{ marginTop: 0 }}>Channel quality</h2>
          {Object.keys(bandQuality).length === 0 ? (
            <p>No quality data yet</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {Object.entries(bandQuality).map(([channel, quality]) => (
                <div
                  key={channel}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#0b1220',
                    border: '1px solid rgba(158,176,209,0.14)',
                  }}
                >
                  <div>
                    <div style={{ color: '#e8eefc', fontWeight: 600 }}>
                      {getChannelLabel(channel, channelNames)}
                    </div>
                    <div style={{ color: '#9eb0d1', fontSize: 12 }}>
                      {quality?.reason || 'No reason available'}
                    </div>
                  </div>
                  <QualityBadge quality={quality} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Session status</h2>
          <p>
            Recording:{' '}
            <strong style={{ color: recordingState.recording ? '#34d399' : '#f59e0b' }}>
              {recordingState.recording ? 'active' : 'idle'}
            </strong>
          </p>
          <p>Analysis: {analysisState.status}</p>
          <p style={{ color: '#9eb0d1', wordBreak: 'break-all', marginBottom: 0 }}>
            {recordingState.path || 'No active session file'}
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Diagnostics</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>
            Lower-priority raw telemetry for debugging and backend verification.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div
              style={{
                background: '#0b1220',
                border: '1px solid rgba(158,176,209,0.14)',
                borderRadius: 12,
                padding: 12,
              }}
            >
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

            <div
              style={{
                background: '#0b1220',
                border: '1px solid rgba(158,176,209,0.14)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Bandpower debug</h3>
              {Object.keys(bandDebug).length === 0 ? (
                <p>No debug data yet</p>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
                  {JSON.stringify(bandDebug, null, 2)}
                </pre>
              )}
            </div>
          </div>
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
        <div
          style={{
            ...card,
            padding: 12,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(11,18,32,0.96))',
            border: '1px solid rgba(96,165,250,0.22)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Live status</h2>
              <p style={{ color: '#9eb0d1', margin: 0 }}>
                Fast operator summary for connection, recording, review target, and signal interpretation state.
              </p>
            </div>
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: deviceStatus?.has_board ? '#86efac' : '#fcd34d',
                background: deviceStatus?.has_board ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                border: deviceStatus?.has_board ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(245,158,11,0.35)',
              }}
            >
              {deviceStatus?.has_board ? 'Headset connected' : 'Headset disconnected'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
              marginTop: 12,
            }}
          >
            <div
              style={{
                background: 'rgba(15,23,42,0.72)',
                border: '1px solid rgba(158,176,209,0.14)',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ color: '#9eb0d1', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recording</div>
              <div style={{ color: recordingState.recording ? '#86efac' : '#fcd34d', fontWeight: 700, marginTop: 6 }}>
                {recordingState.recording ? 'Recording in progress' : 'Idle'}
              </div>
              <div style={{ color: '#9eb0d1', fontSize: 13, marginTop: 6, wordBreak: 'break-word' }}>
                {recordingState.path || 'No active session file'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15,23,42,0.72)',
                border: '1px solid rgba(158,176,209,0.14)',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ color: '#9eb0d1', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Review target</div>
              <div style={{ color: '#e8eefc', fontWeight: 700, marginTop: 6 }}>
                {selectedSessionName || 'Latest analyzed session'}
              </div>
              <div style={{ color: '#9eb0d1', fontSize: 13, marginTop: 6 }}>
                {Object.keys(reviewSummary).length > 0 ? 'Review cards populated' : 'No review summary loaded yet'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15,23,42,0.72)',
                border: reviewSummary.short_session
                  ? '1px solid rgba(245,158,11,0.35)'
                  : '1px solid rgba(158,176,209,0.14)',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ color: '#9eb0d1', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signal interpretation</div>
              <div
                style={{
                  color: reviewSummary.short_session ? '#fbbf24' : '#e8eefc',
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {reviewSummary.short_session ? 'Lower-confidence short recording' : (getSignalGuidanceHint(reviewSummary) || 'No active interpretation')}
              </div>
              <div style={{ color: '#9eb0d1', fontSize: 13, marginTop: 6 }}>
                {reviewSummary.short_session_caution ||
                  latestSessionSignalNote?.body ||
                  'Run or view an analysis to populate the interpretation state.'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15,23,42,0.72)',
                border: analysisState.status === 'error'
                  ? '1px solid rgba(248,113,113,0.35)'
                  : '1px solid rgba(158,176,209,0.14)',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ color: '#9eb0d1', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Analysis</div>
              <div
                style={{
                  color:
                    analysisState.status === 'error'
                      ? '#fca5a5'
                      : analysisState.status === 'loading'
                        ? '#93c5fd'
                        : analysisState.summary
                          ? '#86efac'
                          : '#e8eefc',
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {analysisState.status === 'loading'
                  ? 'Analyzing latest session…'
                  : analysisState.status === 'error'
                    ? 'Analysis error'
                    : analysisState.summary
                      ? 'Analysis ready'
                      : 'No analysis loaded'}
              </div>
              <div style={{ color: analysisState.status === 'error' ? '#fca5a5' : '#9eb0d1', fontSize: 13, marginTop: 6 }}>
                {analysisState.status === 'error'
                  ? analysisState.error
                  : analysisState.summary
                    ? 'Artifacts and review cards are available below.'
                    : 'Run an analysis or select a session to populate review outputs.'}
              </div>
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
              <p>Primary channel: {formatPrimaryChannel(analysisState.summary.primary_channel)}</p>
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

      <section style={{ marginBottom: 16 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Latest session review</h2>
          <p style={{ color: '#9eb0d1', marginTop: 0, marginBottom: 6 }}>
            Review the most recent analyzed session without leaving the live console.
          </p>
          <p style={{ color: '#cbd5e1', marginTop: 0 }}>
            Reviewing: {selectedSessionName || 'latest analyzed session'}
          </p>

          {Object.keys(reviewSummary).length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <div
                style={{
                  background: '#0b1220',
                  border: '1px solid rgba(158,176,209,0.14)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Summary</h3>
                <p>Samples: {reviewSummary.samples || 'n/a'}</p>
                <p>Duration (s): {reviewSummary.duration_s || 'n/a'}</p>
                <p>Primary channel: {formatPrimaryChannel(reviewSummary.primary_channel)}</p>
                <p style={{ marginBottom: 0 }}>
                  Alpha / (alpha + beta): {reviewSummary.alpha_over_alpha_beta || 'n/a'}
                </p>
              </div>

              <div
                style={{
                  background: '#0b1220',
                  border: '1px solid rgba(158,176,209,0.14)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Recording context</h3>
                <p>Recording label: {reviewSummary.recording_label || 'n/a'}</p>
                <p>
                  Metadata source: {{
                    manifest: 'persisted manifest',
                    fallback: 'heuristic fallback',
                    unknown: 'unknown',
                  }[analysisState.recordingMetadata?.recording_metadata_source || 'unknown']}
                </p>
                <p>Duration (s): {analysisState.recordingMetadata?.duration_seconds ?? 'n/a'}</p>
                <p style={{ marginBottom: 0 }}>
                  EEG packets: {analysisState.recordingMetadata?.eeg_packets ?? 'n/a'}
                </p>
              </div>

              <div
                style={{
                  background: '#0b1220',
                  border: '1px solid rgba(158,176,209,0.14)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Band means</h3>
                <p>Mean alpha: {reviewSummary.mean_alpha || 'n/a'}</p>
                <p>Mean beta: {reviewSummary.mean_beta || 'n/a'}</p>
                <p style={{ color: '#9eb0d1', marginBottom: 0 }}>
                  Values come from the analyzer summary CSV for the latest completed session.
                </p>
              </div>

              <div
                style={{
                  background: '#0b1220',
                  border: '1px solid rgba(158,176,209,0.14)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Signal note</h3>
                <p style={{ color: '#9eb0d1', fontSize: 12, marginTop: 4, marginBottom: 6 }}>
                  {latestSessionSignalNote?.title || 'Spectral summary'}
                </p>
                <p style={{ color: '#cbd5e1', marginBottom: reviewSummary.short_session ? 10 : 0 }}>
                  {getSignalGuidanceHint(reviewSummary) ||
                  latestSessionSignalNote?.body ||
                  'Run a session analysis to generate a quick interpretation.'}
                </p>
                {reviewSummary.short_session && reviewSummary.short_session_caution && (
                  <div
                    style={{
                      marginTop: 0,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      color: '#fbbf24',
                    }}
                  >
                    {reviewSummary.short_session_caution}
                  </div>
                )}
              </div>

              <div
                style={{
                  background: '#0b1220',
                  border: '1px solid rgba(158,176,209,0.14)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Artifacts</h3>

                {analysisState.bandsPng ? (
                  <p>
                    <a
                      href={`http://localhost:8008/api/sessions/artifacts/${analysisState.bandsPng.split('/').pop()}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open band chart PNG
                    </a>
                  </p>
                ) : (
                  <p>No band chart artifact yet</p>
                )}

                {analysisState.summaryCsv ? (
                  <p>
                    <a
                      href={`http://localhost:8008/api/sessions/artifacts/${analysisState.summaryCsv.split('/').pop()}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download summary CSV
                    </a>
                  </p>
                ) : (
                  <p>No summary CSV yet</p>
                )}

                {analysisState.timeseriesCsv ? (
                  <p style={{ marginBottom: 0 }}>
                    <a
                      href={`http://localhost:8008/api/sessions/artifacts/${analysisState.timeseriesCsv.split('/').pop()}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download time series CSV
                    </a>
                  </p>
                ) : (
                  <p style={{ marginBottom: 0 }}>No time series CSV yet</p>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#0b1220',
                border: '1px solid rgba(158,176,209,0.14)',
                borderRadius: 12,
                padding: 12,
                color: '#9eb0d1',
              }}
            >
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
              <p style={{ color: '#9eb0d1', marginTop: 0, marginBottom: 0 }}>
                Recorded sessions with analysis status and artifact access.
              </p>
            </div>
            <button onClick={loadSessionHistory}>Refresh history</button>
          </div>

          {sessionHistoryStatus === 'loading' && <p>Loading session history…</p>}
          {sessionHistoryStatus === 'error' && (
            <p style={{ color: '#f87171' }}>Could not load session history.</p>
          )}

          {sessionHistoryStatus !== 'loading' && sessionHistory.length === 0 ? (
            <p style={{ color: '#9eb0d1' }}>No recorded sessions found yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {sessionHistory.map((session) => (
                <div
                  key={session.session_name}
                  style={{
                    background: selectedSessionName === session.session_name ? 'rgba(30,41,59,0.95)' : '#0b1220',
                    border: selectedSessionName === session.session_name ? '1px solid rgba(96,165,250,0.7)' : '1px solid rgba(158,176,209,0.14)',
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#e8eefc', fontWeight: 700 }}>{session.session_name}</div>
                      <div style={{ color: '#9eb0d1', fontSize: 12 }}>{session.timestamp}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: session.analyzed ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                          border: session.analyzed ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(245,158,11,0.35)',
                          color: session.analyzed ? '#86efac' : '#fcd34d',
                        }}
                      >
                        {session.analyzed ? 'Analyzed' : 'Recorded only'}
                      </div>
                      {selectedSessionName === session.session_name ? (
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'rgba(96,165,250,0.14)',
                            border: '1px solid rgba(96,165,250,0.35)',
                            color: '#bfdbfe',
                          }}
                        >
                          Reviewing
                        </div>
                      ) : null}
                      {session.recording_label === 'short' ? (
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'rgba(248,113,113,0.12)',
                            border: '1px solid rgba(248,113,113,0.35)',
                            color: '#fca5a5',
                          }}
                        >
                          Short recording
                        </div>
                      ) : null}
                      {session.recording_metadata?.recording_metadata_source === 'fallback' ? (
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'rgba(148,163,184,0.12)',
                            border: '1px solid rgba(148,163,184,0.28)',
                            color: '#cbd5e1',
                          }}
                          title="Session metadata reconstructed heuristically from legacy session data"
                        >
                          Metadata: heuristic
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {session.recording_metadata ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        background: 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(96,165,250,0.16)',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span style={detailChipBase}>
                          Duration: {session.recording_metadata.duration_seconds ?? 'n/a'} s
                        </span>
                        <span style={detailChipBase}>
                          EEG packets: {session.recording_metadata.eeg_packets ?? 'n/a'}
                        </span>
                        {session.recording_metadata.recording_metadata_source === 'fallback' ? (
                          <span
                            style={{
                              ...detailChipBase,
                              background: 'rgba(148,163,184,0.14)',
                              border: '1px solid rgba(148,163,184,0.28)',
                            }}
                            title="Session metadata reconstructed heuristically from legacy session data"
                          >
                            Metadata: heuristic fallback
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {session.summary ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        background: 'rgba(158,176,209,0.08)',
                        border: '1px solid rgba(158,176,209,0.12)',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span style={detailChipBase}>
                          Primary: {formatPrimaryChannel(session.summary.primary_channel)}
                        </span>
                        <span style={detailChipBase}>
                          Alpha/(alpha+beta): {session.summary.alpha_over_alpha_beta ?? 'n/a'}
                        </span>
                        <span style={detailChipBase}>
                          Fast/total: {session.summary.fast_over_total ?? 'n/a'}
                        </span>
                        <span style={detailChipBase}>
                          Slow/total: {session.summary.slow_over_total ?? 'n/a'}
                        </span>
                      </div>
                      {session.summary.guidance_hint ? (
                        <div style={{ color: '#9eb0d1', marginTop: 8, fontSize: 12 }}>
                          Note: {session.summary.guidance_hint}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                    {session.analyzed ? (
                      <>
                        <button
                          onClick={() => viewSession(session)}
                          disabled={selectedSessionName === session.session_name}
                        >
                          {selectedSessionName === session.session_name ? 'In review' : 'Open review'}
                        </button>
                        <button
                          onClick={() => analyzeSessionByName(session.session_name)}
                          disabled={selectedSessionName === session.session_name && analysisState.status === 'loading'}
                        >
                          {selectedSessionName === session.session_name && analysisState.status === 'loading' ? 'Reanalyzing…' : 'Reanalyze'}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => analyzeSessionByName(session.session_name)}>
                        Analyze
                      </button>
                    )}

                    {(session.bands_png || session.summary_csv || session.timeseries_csv) && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ color: '#9eb0d1', fontSize: 12 }}>Artifacts:</span>

                        {session.bands_png && (
                          <a
                            href={`http://localhost:8008/api/sessions/artifacts/${session.bands_png.split('/').pop()}`}
                            target="_blank"
                            rel="noreferrer"
                            style={detailChipBase}
                          >
                            Band chart
                          </a>
                        )}

                        {session.summary_csv && (
                          <a
                            href={`http://localhost:8008/api/sessions/artifacts/${session.summary_csv.split('/').pop()}`}
                            target="_blank"
                            rel="noreferrer"
                            style={detailChipBase}
                          >
                            Summary CSV
                          </a>
                        )}

                        {session.timeseries_csv && (
                          <a
                            href={`http://localhost:8008/api/sessions/artifacts/${session.timeseries_csv.split('/').pop()}`}
                            target="_blank"
                            rel="noreferrer"
                            style={detailChipBase}
                          >
                            Time series CSV
                          </a>
                        )}
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
          <p style={{ color: '#9eb0d1', marginTop: 0 }}>
            Secondary transport and sensor inspection for development, validation, and troubleshooting.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(devices, null, 2)}</pre>
        </div>
        <div style={card}>
          <h3>Recent events</h3>
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

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(<App />)
}
