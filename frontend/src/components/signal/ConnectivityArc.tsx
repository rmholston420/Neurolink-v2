import React, { useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { TONE_PEAK } from '../../lib/vajra'

// ConnectivityArc — arc diagram of inter-electrode coupling.
//
// v1 approximated PLV from band-power cosine similarity (with a synthetic-noise
// fallback). v2 computes a *real* metric client-side: the absolute Pearson
// correlation of the raw sample buffers for each electrode pair. This is a
// broadband coupling proxy (true PLV needs per-band phase), computed only from
// hardware samples — no synthetic fallback. Arc opacity/width ∝ |r|.

interface Props {
  signals: Record<string, number[]>
}

const W = 260
const H = 200
const CX = W / 2
const CY = H / 2 + 10
const NODE_R = 80

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 8) return 0
  let sa = 0
  let sb = 0
  for (let i = 0; i < n; i++) {
    sa += a[i]
    sb += b[i]
  }
  const ma = sa / n
  const mb = sb / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma
    const xb = b[i] - mb
    num += xa * xb
    da += xa * xa
    db += xb * xb
  }
  const den = Math.sqrt(da * db)
  if (den < 1e-9) return 0
  return Math.max(0, Math.min(1, Math.abs(num / den)))
}

function cubicArc(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const cx = mx + (CX - mx) * 0.5
  const cy = my + (CY - my) * 0.5
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`
}

export function ConnectivityArc({ signals }: Props) {
  const [threshold, setThreshold] = useState(0.3)
  const labels = Object.keys(signals)

  const { nodes, pairs } = useMemo(() => {
    const ls = Object.keys(signals)
    const nodePos: Record<string, [number, number]> = {}
    ls.forEach((l, i) => {
      const a = (Math.PI * 2 * i) / Math.max(1, ls.length) - Math.PI / 2
      nodePos[l] = [CX + NODE_R * Math.cos(a), CY + NODE_R * Math.sin(a)]
    })
    const ps: Array<{ a: string; b: string; r: number }> = []
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        ps.push({ a: ls[i], b: ls[j], r: pearson(signals[ls[i]], signals[ls[j]]) })
      }
    }
    return { nodes: nodePos, pairs: ps }
  }, [signals])

  const color = TONE_PEAK

  return (
    <Card title="Connectivity" subtitle="Inter-electrode correlation · raw samples">
      {labels.length < 2 ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Need at least two channels of raw signal.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W }} aria-label="Connectivity arcs">
            {pairs.map(({ a, b, r }) => {
              if (r < threshold) return null
              const [x1, y1] = nodes[a]
              const [x2, y2] = nodes[b]
              return (
                <path key={`${a}-${b}`} d={cubicArc(x1, y1, x2, y2)} fill="none" stroke={color} strokeWidth={1 + r * 4} strokeOpacity={0.2 + r * 0.75} />
              )
            })}
            {labels.map((ch) => {
              const [x, y] = nodes[ch]
              const maxR = Math.max(0, ...pairs.filter((p) => p.a === ch || p.b === ch).map((p) => p.r))
              return (
                <g key={ch}>
                  <circle cx={x} cy={y} r={10 + maxR * 6} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} />
                  <text x={x} y={y + 4} textAnchor="middle" fill="var(--ink-primary)" fontSize={10} fontWeight="bold">{ch}</text>
                </g>
              )
            })}
          </svg>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', width: '100%' }}>
            {pairs.map(({ a, b, r }) => (
              <div key={`${a}-${b}`} className="font-mono" style={{ fontSize: 11, color: r >= threshold ? 'var(--ink-muted)' : 'var(--ink-whisper)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{a}↔{b}</span>
                <span style={{ color }}>{(r * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }} className="nl-muted">
            <span style={{ fontSize: 11 }}>threshold</span>
            <input type="range" min={0} max={90} step={5} value={Math.round(threshold * 100)} onChange={(e) => setThreshold(Number(e.target.value) / 100)} style={{ flex: 1, accentColor: color }} />
            <span className="font-mono" style={{ fontSize: 11 }}>{Math.round(threshold * 100)}%</span>
          </div>
        </div>
      )}
    </Card>
  )
}
