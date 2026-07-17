import React, { useEffect, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { BAND_ORDER, BAND_VAR, BAND_HEX, rampTopo, type BandName } from '../../lib/vajra'

// TopoMap — Canvas 2D 4-electrode frontal topographic map.
//
// Power for the selected band is interpolated over a 64×64 grid with
// inverse-distance weighting (p=2) and painted through the Vajra topo ramp
// (teal→indigo→fire), normalised against a running mean/range. Values come
// from the live per-channel band powers only — there is no synthetic fallback;
// with no signal the map stays empty rather than inventing data.

// Electrode layout (normalised 0–1 within the head circle). Athena's frontal
// montage is spatially equivalent to the classic frontal-4.
// TODO: verify Athena channel names
const ELECTRODES: { name: string; nx: number; ny: number }[] = [
  { name: 'AF7', nx: -0.42, ny: 0.55 },
  { name: 'AF8', nx: 0.42, ny: 0.55 },
  { name: 'TP9', nx: -0.72, ny: -0.2 },
  { name: 'TP10', nx: 0.72, ny: -0.2 },
]

const GRID = 64
const R = 0.82
const CANVAS_SIZE = 240

function idw(values: number[], gx: number, gy: number, p = 2): number {
  let num = 0
  let den = 0
  for (let i = 0; i < ELECTRODES.length; i++) {
    const dx = gx - ELECTRODES[i].nx
    const dy = gy - ELECTRODES[i].ny
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 1e-6) return values[i]
    const w = 1 / Math.pow(d, p)
    num += w * values[i]
    den += w
  }
  return den > 0 ? num / den : 0
}

interface Props {
  // Live per-channel band powers, keyed by electrode label.
  channelBands: Record<string, Partial<Record<BandName, number>>>
}

export function TopoMap({ channelBands }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [band, setBand] = useState<BandName>('alpha')
  const meanRef = useRef(0)
  const rangeRef = useRef(1)

  const raw = ELECTRODES.map((e) => Number(channelBands[e.name]?.[band]) || 0)
  const hasData = raw.some((v) => v > 0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const S = CANVAS_SIZE
    ctx.clearRect(0, 0, S, S)
    if (!hasData) return

    const avg = raw.reduce((s, v) => s + v, 0) / raw.length
    meanRef.current = meanRef.current * 0.9 + avg * 0.1
    const rng = Math.max(...raw) - Math.min(...raw)
    rangeRef.current = rangeRef.current * 0.9 + (rng || 1) * 0.1
    const mu = meanRef.current
    const rr = rangeRef.current || 1

    const cx = S / 2
    const cy = S / 2
    const r = (S / 2) * R
    const toPixel = (nx: number, ny: number): [number, number] => [cx + nx * r, cy - ny * r]

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const step = S / GRID
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const nx = (gx / GRID - 0.5) / (R / 2)
        const ny = -(gy / GRID - 0.5) / (R / 2)
        if (nx * nx + ny * ny > 1.0 / (R * R)) continue
        const val = idw(raw, nx * R, ny * R)
        const t = 0.5 + (val - mu) / (2 * rr)
        ctx.fillStyle = rampTopo(t)
        ctx.fillRect(gx * step, gy * step, step + 1, step + 1)
      }
    }
    ctx.restore()

    ctx.strokeStyle = '#5b617a' // ink-whisper
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    // Nose
    ctx.beginPath()
    ctx.moveTo(cx - 10, cy - r + 4)
    ctx.lineTo(cx, cy - r - 12)
    ctx.lineTo(cx + 10, cy - r + 4)
    ctx.stroke()

    ELECTRODES.forEach((el) => {
      const [px, py] = toPixel(el.nx, el.ny)
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ede7d3' // ink-primary
      ctx.fill()
      ctx.strokeStyle = '#07080d' // bg-void
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = '#ede7d3'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(el.name, px, py - 8)
    })
  }, [raw, band, hasData])

  return (
    <Card title="Topographic map" subtitle="Frontal-4 · IDW interpolation">
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {BAND_ORDER.map((b) => (
          <button
            key={b}
            className="nl-btn"
            onClick={() => setBand(b)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              background: b === band ? BAND_VAR[b] : undefined,
              color: b === band ? 'var(--bg-void)' : BAND_HEX[b],
              borderColor: b === band ? BAND_VAR[b] : undefined,
            }}
          >
            {b}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{ borderRadius: '50%', width: 240, height: 240 }}
          aria-label="Topographic map"
        />
        {!hasData && <p className="nl-muted">Start the stream to populate the map.</p>}
        <div className="nl-whisper" style={{ textAlign: 'center', maxWidth: 220 }}>
          4-electrode coverage — interpolation is suggestive, not clinically precise.
        </div>
      </div>
    </Card>
  )
}
