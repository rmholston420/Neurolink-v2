import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [devices, setDevices] = useState([])
  const [status, setStatus] = useState('idle')
  const [frame, setFrame] = useState(null)
  const apiBase = useMemo(() => 'http://localhost:8000', [])

  async function scan() {
    setStatus('scanning')
    const r = await fetch(`${apiBase}/devices/scan`)
    const data = await r.json()
    setDevices(data)
    setStatus('ready')
  }

  async function start(macAddress = '') {
    await fetch(`${apiBase}/session/start?mac_address=${encodeURIComponent(macAddress)}`, { method: 'POST' })
    setStatus('streaming')
  }

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/live')
    ws.onmessage = (event) => setFrame(JSON.parse(event.data))
    return () => ws.close()
  }, [])

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Neurolink-v2</h1>
      <p>Find a Muse Athena, connect, and inspect live EEG session frames.</p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={scan}>Scan Devices</button>
        <button onClick={() => start(devices[0]?.address || '')}>Start Stream</button>
      </div>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#131c31', padding: 16, borderRadius: 12 }}>
          <h2>Nearby Muse Devices</h2>
          <pre>{JSON.stringify(devices, null, 2)}</pre>
        </div>
        <div style={{ background: '#131c31', padding: 16, borderRadius: 12 }}>
          <h2>Latest Frame</h2>
          <pre>{JSON.stringify(frame, null, 2)}</pre>
        </div>
      </section>
      <p>Status: {status}</p>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
