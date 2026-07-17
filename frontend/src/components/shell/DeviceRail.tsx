import React from 'react'
import type { NeurolinkStore } from '../../hooks/useNeurolinkStore'
import { StatusPill } from '../ui/Card'
import { getChannelLabel } from '../../lib/bandpower.js'

// Frontal-4 positions (0..1) for a mini contact-quality topo. Athena's frontal
// layout is spatially equivalent; channel_names from the backend drive labels.
const NODES = [
  { x: 0.22, y: 0.62 }, // TP9  (left ear)
  { x: 0.36, y: 0.30 }, // AF7  (left front)
  { x: 0.64, y: 0.30 }, // AF8  (right front)
  { x: 0.78, y: 0.62 }, // TP10 (right ear)
]

const QUALITY_TONE: Record<string, string> = {
  good: 'var(--accent-teal)',
  warn: 'var(--accent-saffron)',
  'artifact-likely': 'var(--accent-maroon)',
  flat: 'var(--ink-whisper)',
  'insufficient-window': 'var(--accent-frost)',
  unknown: 'var(--ink-whisper)',
}

function MiniTopo({ store }: { store: NeurolinkStore }) {
  const { bandQuality, channelNames } = store
  const keys = Object.keys(bandQuality)
  return (
    <svg viewBox="0 0 100 90" style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Contact quality">
      <ellipse cx="50" cy="46" rx="40" ry="42" fill="rgba(255,255,255,0.02)" stroke="var(--stroke-veil)" strokeWidth="1" />
      <path d="M50 4 l-6 8 h12 z" fill="var(--stroke-veil)" />
      {NODES.map((node, i) => {
        const key = keys[i] ?? String(i)
        const q = bandQuality[key]
        const color = QUALITY_TONE[q?.status ?? 'unknown'] ?? 'var(--ink-whisper)'
        return (
          <g key={i}>
            <circle cx={node.x * 100} cy={node.y * 90} r="7" fill={color} opacity={q ? 0.9 : 0.35} />
            <text x={node.x * 100} y={node.y * 90 + 3} textAnchor="middle" fontSize="6" fill="var(--bg-void)" fontWeight="700">
              {getChannelLabel(key, channelNames).slice(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function DeviceRail({ store, onRecalibrate }: { store: NeurolinkStore; onRecalibrate?: () => void }) {
  const {
    deviceStatus, streamHealth, wsStatus, battery,
    scan, connect, disconnect,
    scanning, connecting, scanResults, selectedDevice, setSelectedDevice,
    lastPaired, deviceError,
  } = store
  const connected = Boolean(deviceStatus?.has_board)
  const streaming = Boolean(deviceStatus?.is_streaming)
  const transport = deviceStatus?.transport_metadata?.backend || deviceStatus?.transport_metadata?.transport || 'brainflow'

  // Connect is enabled when the user has a target: a picked scan result or a
  // persisted last-paired device (so "Reconnect to X" works with no scan).
  const hasTarget = Boolean(selectedDevice || lastPaired)
  const connectLabel = connecting
    ? 'Connecting…'
    : selectedDevice
      ? `Connect ${selectedDevice.name}`
      : lastPaired
        ? `Reconnect to ${lastPaired.display_name}`
        : 'Connect'

  return (
    <aside className="nl-rail" aria-label="Device status">
      <div>
        <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Device</div>
        <StatusPill tone={connected ? 'good' : 'bad'}>{connected ? 'Athena connected' : 'Disconnected'}</StatusPill>
        <div style={{ marginTop: 8 }}>
          <StatusPill tone={streaming ? 'good' : 'warn'}>{streaming ? 'Streaming' : 'Idle'}</StatusPill>
        </div>
        <div style={{ marginTop: 8 }}>
          <StatusPill tone={wsStatus === 'open' ? 'good' : wsStatus === 'connecting' ? 'warn' : 'bad'}>
            socket {wsStatus}
          </StatusPill>
        </div>

        <div className="nl-stack" style={{ gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="nl-btn"
            style={{ width: '100%' }}
            onClick={() => { void scan() }}
            disabled={scanning}
            aria-label="Scan for nearby devices"
            aria-busy={scanning}
          >
            {scanning ? 'Scanning…' : 'Scan'}
          </button>

          {scanResults.length > 0 && (
            <label className="nl-whisper" style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: 4 }}>Discovered devices</span>
              <select
                className="nl-btn"
                style={{ width: '100%', cursor: 'pointer' }}
                aria-label="Select a discovered device"
                value={selectedDevice?.address ?? ''}
                onChange={(e) => {
                  const dev = scanResults.find((d) => d.address === e.target.value) ?? null
                  setSelectedDevice(dev)
                }}
              >
                {scanResults.map((d) => (
                  <option key={d.address} value={d.address}>
                    {d.name} · {d.address}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className="nl-btn nl-btn-primary"
            style={{ width: '100%' }}
            onClick={() => { void connect() }}
            disabled={connecting || (!hasTarget)}
            aria-label={connectLabel}
            aria-busy={connecting}
          >
            {connectLabel}
          </button>

          <button
            type="button"
            className="nl-btn"
            style={{ width: '100%' }}
            onClick={() => { void disconnect() }}
            disabled={!connected && !streaming}
            aria-label="Disconnect device"
          >
            Disconnect
          </button>

          {deviceError && (
            <div role="alert" className="nl-whisper" style={{ color: 'var(--accent-maroon)' }}>
              {deviceError}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Contact quality</div>
        <MiniTopo store={store} />
      </div>

      {onRecalibrate && (
        <button type="button" className="nl-btn nl-btn-primary" style={{ width: '100%' }} onClick={onRecalibrate}>
          Recalibrate
        </button>
      )}

      <div>
        <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Battery</div>
        <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink-primary)' }}>
          {battery == null ? '—' : `${Number(battery).toFixed(0)}%`}
        </div>
      </div>

      <div>
        <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Transport</div>
        <div className="nl-muted font-mono" style={{ fontSize: 13 }}>{transport}</div>
      </div>

      <div>
        <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Stream health</div>
        <dl className="font-mono" style={{ margin: 0, fontSize: 12, color: 'var(--ink-muted)', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
          <dt>frames</dt><dd style={{ margin: 0, textAlign: 'right' }}>{streamHealth?.frames_total ?? 0}</dd>
          <dt>clean</dt><dd style={{ margin: 0, textAlign: 'right' }}>{streamHealth?.frames_clean ?? 0}</dd>
          <dt>rejected</dt><dd style={{ margin: 0, textAlign: 'right' }}>{streamHealth?.frames_rejected ?? 0}</dd>
          <dt>loss %</dt><dd style={{ margin: 0, textAlign: 'right' }}>{(streamHealth?.packet_loss_pct ?? 0).toFixed(1)}</dd>
          <dt>tick ms</dt><dd style={{ margin: 0, textAlign: 'right' }}>{(streamHealth?.avg_tick_ms ?? 0).toFixed(1)}</dd>
        </dl>
      </div>
    </aside>
  )
}
