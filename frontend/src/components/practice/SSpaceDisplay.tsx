import React from 'react'
import { Card, StatusPill } from '../ui/Card'

// Enlarged α–θ state space (regions A–H). x = normalized alpha, y = normalized
// theta (each capped at power/2 to match the classifier). The live point tracks
// the meditator; regions E–H open the EA-1 gate and are tinted gold.

interface Props {
  alpha: number
  theta: number
  region: string
  stage: string
  size?: number
}

// Region anchor thresholds (alpha, theta) mirrored from sSpace.js, used to place
// the labels roughly where each region begins.
const REGION_ANCHORS: Array<[string, number, number]> = [
  ['A', 0.08, 0.08],
  ['B', 0.34, 0.46],
  ['C', 0.54, 0.26],
  ['D', 0.54, 0.46],
  ['E', 0.54, 0.78],
  ['F', 0.74, 0.26],
  ['G', 0.74, 0.5],
  ['H', 0.78, 0.8],
]

const GATE_OPEN = new Set(['E', 'F', 'G', 'H'])
const ALPHA_LINES = [0.3, 0.5, 0.7]
const THETA_LINES = [0.2, 0.4, 0.7]

export function SSpaceDisplay({ alpha, theta, region, stage, size = 300 }: Props) {
  const normA = Math.min((alpha || 0) / 2.0, 1.0)
  const normT = Math.min((theta || 0) / 2.0, 1.0)
  const pad = 28
  const plot = size - pad * 2
  const px = pad + normA * plot
  const py = pad + (1 - normT) * plot
  const gateOpen = GATE_OPEN.has(region)

  return (
    <Card
      title="S-space"
      subtitle="α–θ state plane · regions A–H"
      actions={<StatusPill tone={gateOpen ? 'good' : 'neutral'}>{region} · {stage}</StatusPill>}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} aria-label="s-space plane">
        {/* frame */}
        <rect x={pad} y={pad} width={plot} height={plot} fill="var(--bg-void)" stroke="var(--stroke-veil)" />
        {/* gate zone: upper-right (high alpha & theta) tinted gold */}
        <rect
          x={pad + 0.5 * plot}
          y={pad}
          width={0.5 * plot}
          height={0.8 * plot}
          fill="var(--halo-gold)"
          opacity={0.25}
        />
        {/* threshold gridlines */}
        {ALPHA_LINES.map((a) => (
          <line key={`a${a}`} x1={pad + a * plot} y1={pad} x2={pad + a * plot} y2={pad + plot} stroke="var(--stroke-veil)" strokeDasharray="3 4" />
        ))}
        {THETA_LINES.map((t) => (
          <line key={`t${t}`} x1={pad} y1={pad + (1 - t) * plot} x2={pad + plot} y2={pad + (1 - t) * plot} stroke="var(--stroke-veil)" strokeDasharray="3 4" />
        ))}
        {/* region labels */}
        {REGION_ANCHORS.map(([rg, a, t]) => (
          <text
            key={rg}
            x={pad + a * plot}
            y={pad + (1 - t) * plot}
            textAnchor="middle"
            fontFamily="var(--font-mono, monospace)"
            fontSize={13}
            fontWeight={rg === region ? 700 : 400}
            fill={rg === region ? 'var(--accent-gold)' : GATE_OPEN.has(rg) ? 'var(--accent-teal)' : 'var(--ink-whisper)'}
          >
            {rg}
          </text>
        ))}
        {/* live point */}
        <circle cx={px} cy={py} r={7} fill="var(--accent-gold)" stroke="var(--bg-void)" strokeWidth={2}>
          <title>α {normA.toFixed(2)} · θ {normT.toFixed(2)}</title>
        </circle>
        {/* axis labels */}
        <text x={pad + plot / 2} y={size - 6} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">alpha →</text>
        <text x={10} y={pad + plot / 2} textAnchor="middle" fontSize={11} fill="var(--ink-muted)" transform={`rotate(-90 10 ${pad + plot / 2})`}>theta →</text>
      </svg>
      <div className="nl-whisper">Gold zone opens the EA-1 gate (regions E–H).</div>
    </Card>
  )
}
