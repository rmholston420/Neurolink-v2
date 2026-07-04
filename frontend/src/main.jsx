import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

const card = {
  background: '#131c31',
  padding: 16,
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
}

function App() {
  const [devices, setDevices] = useState([])
  const [deviceStatus, setDeviceStatus] = useState(null)
  const [streamStatus, setStreamStatus] = useState('idle')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [latest, setLatest] = useState({ eeg: null, optical: null, imu: null })
  const [events, setEvents] = useState([])
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

  useEffect(() => {
    refreshStatus().catch(() => {})
    const ws = new WebSocket('ws://localhost:8008/api/stream/ws')
    wsRef.current = ws
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'ping') return
      if (msg.type === 'eeg') setLatest((prev) => ({ ...prev, eeg: msg }))
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

  const bandPowers = latest.eeg?.band_powers || {}
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
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
                  <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(bands, null, 2)}</pre>
                </div>
              ))}
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginTop: 16 }}>
        <div style={card}>
          <h2>Latest EEG frame</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(latest.eeg, null, 2)}</pre>
        </div>
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
