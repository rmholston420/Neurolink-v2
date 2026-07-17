import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Card } from '../ui/Card'
import { rampSpectro } from '../../lib/vajra'

// RollingSpectrogram — Canvas 2D rolling STFT spectrogram for one channel.
//
// A Hann-windowed O(n²) DFT (n=64) over the newest samples yields a power
// spectrum, painted as a new right-hand column each frame with a log-frequency
// y-axis and the viridis-in-Vajra ramp (teal→indigo→fire→gold). Driven purely
// by real hardware samples — when none are present the canvas holds and a
// notice is shown; nothing synthetic is ever drawn.

const CANVAS_W = 480
const CANVAS_H = 120
const FFT_SIZE = 64
const FS = 256
const FREQ_MIN = 1
const FREQ_MAX = 50
const BAND_BOUNDARIES = [4, 8, 13, 30]

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  return w
}

function powerSpectrum(samples: number[], hann: Float32Array): Float32Array {
  const n = hann.length
  const re = new Float32Array(n)
  for (let i = 0; i < n; i++) re[i] = (samples[i] ?? 0) * hann[i]
  const half = n / 2
  const ps = new Float32Array(half)
  for (let k = 0; k < half; k++) {
    let sumRe = 0
    let sumIm = 0
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n
      sumRe += re[t] * Math.cos(angle)
      sumIm -= re[t] * Math.sin(angle)
    }
    ps[k] = sumRe * sumRe + sumIm * sumIm
  }
  return ps
}

function freqToY(hz: number, h: number): number {
  const logMin = Math.log10(FREQ_MIN)
  const logMax = Math.log10(FREQ_MAX)
  const norm = (Math.log10(Math.max(hz, FREQ_MIN)) - logMin) / (logMax - logMin)
  return h - norm * h
}

interface Props {
  // Per-channel raw sample buffers (µV), keyed by electrode label.
  signals: Record<string, number[]>
}

export function RollingSpectrogram({ signals }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hannRef = useRef<Float32Array>(hannWindow(FFT_SIZE))
  const labels = Object.keys(signals)
  const [channel, setChannel] = useState<string>('mean')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const chLabels = Object.keys(signals)
    if (chLabels.length === 0) return

    let signal: number[]
    if (channel === 'mean' || !signals[channel]) {
      const arrs = chLabels.map((l) => signals[l])
      const len = Math.max(...arrs.map((a) => a.length))
      signal = Array.from({ length: len }, (_, i) => arrs.reduce((s, a) => s + (a[i] ?? 0), 0) / arrs.length)
    } else {
      signal = signals[channel]
    }
    if (signal.length < FFT_SIZE) return

    const window = signal.slice(-FFT_SIZE)
    const ps = powerSpectrum(window, hannRef.current)
    const logPs = ps.map((p) => Math.log(p + 1e-9))
    let lo = Infinity
    let hi = -Infinity
    for (let k = 1; k < logPs.length; k++) {
      if (logPs[k] < lo) lo = logPs[k]
      if (logPs[k] > hi) hi = logPs[k]
    }
    const span = hi - lo || 1

    const img = ctx.getImageData(1, 0, CANVAS_W - 1, CANVAS_H)
    ctx.putImageData(img, 0, 0)
    ctx.clearRect(CANVAS_W - 1, 0, 1, CANVAS_H)

    for (let k = 1; k < ps.length; k++) {
      const hz = (k * FS) / (FFT_SIZE * 2)
      if (hz < FREQ_MIN || hz > FREQ_MAX) continue
      const y1 = Math.round(freqToY(hz, CANVAS_H))
      const y0 = Math.round(freqToY(((k - 1) * FS) / (FFT_SIZE * 2), CANVAS_H))
      const h = Math.max(1, Math.abs(y0 - y1))
      ctx.fillStyle = rampSpectro((logPs[k] - lo) / span)
      ctx.fillRect(CANVAS_W - 1, y1, 1, h)
    }

    ctx.strokeStyle = 'rgba(237,231,211,0.22)'
    ctx.setLineDash([2, 3])
    ctx.lineWidth = 1
    for (const hz of BAND_BOUNDARIES) {
      const y = Math.round(freqToY(hz, CANVAS_H))
      ctx.beginPath()
      ctx.moveTo(CANVAS_W - 8, y)
      ctx.lineTo(CANVAS_W - 1, y)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }, [signals, channel])

  useEffect(() => {
    draw()
  }, [draw])

  const hasData = labels.length > 0

  return (
    <Card title="Rolling spectrogram" subtitle="STFT · log frequency · 60 s window">
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {['mean', ...labels].map((l) => (
          <button
            key={l}
            className="nl-btn"
            onClick={() => setChannel(l)}
            style={{ padding: '4px 12px', fontSize: 12, ...(l === channel ? { background: 'var(--accent-saffron)', color: 'var(--bg-void)', borderColor: 'var(--accent-saffron)' } : {}) }}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative', background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%', imageRendering: 'pixelated' }}
          aria-label="Rolling spectrogram"
        />
        <div
          className="font-mono"
          style={{ position: 'absolute', top: 0, left: 4, fontSize: 9, color: 'var(--ink-whisper)', display: 'flex', flexDirection: 'column', height: CANVAS_H, justifyContent: 'space-between', pointerEvents: 'none' }}
        >
          <span>50Hz</span>
          <span>13Hz</span>
          <span>4Hz</span>
          <span>1Hz</span>
        </div>
      </div>
      {!hasData && <p className="nl-muted" style={{ marginBottom: 0 }}>No raw samples yet — start the stream.</p>}
    </Card>
  )
}
