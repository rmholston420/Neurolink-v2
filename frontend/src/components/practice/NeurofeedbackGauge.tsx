import React, { useEffect, useRef, useState } from 'react'
import { BREATH_PERIOD_MS, prefersReducedMotion } from '../../theme/motion'
import type { MeditationDerived } from '../../hooks/useNeurolinkStore'

// Radial dial fusing engagement, integration coverage, and EA-1 progress into
// one poetic gauge. When EA-1 eligible, a gold halo pulses at the target breath
// cadence (5.5 bpm). Reduced-motion replaces the pulse with a static glow.
interface Props {
  meditation: MeditationDerived
  ea1Eligible?: boolean
  ea1Score?: number
  size?: number
}

const TAU = Math.PI * 2

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const x0 = cx + r * Math.cos(start)
  const y0 = cy + r * Math.sin(start)
  const x1 = cx + r * Math.cos(end)
  const y1 = cy + r * Math.sin(end)
  const large = end - start > Math.PI ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function NeurofeedbackGauge({ meditation, ea1Eligible = false, ea1Score = 0, size = 320 }: Props) {
  const [phase, setPhase] = useState(0)
  const raf = useRef<number | undefined>(undefined)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (reduced || !ea1Eligible) {
      setPhase(0)
      return
    }
    let start: number | null = null
    const loop = (t: number) => {
      if (start === null) start = t
      setPhase((((t - start) % BREATH_PERIOD_MS) / BREATH_PERIOD_MS))
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [ea1Eligible, reduced])

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  // Sweep from 135° through 405° (270° usable arc).
  const a0 = (135 * Math.PI) / 180
  const sweep = (270 * Math.PI) / 180

  const eng = Math.max(0, Math.min(1, meditation.engagement))
  const cov = Math.max(0, Math.min(1, meditation.coverage))
  const ea1 = Math.max(0, Math.min(1, ea1Score))

  const haloScale = reduced ? 1.02 : 1 + Math.sin(phase * TAU) * 0.05
  const haloOpacity = ea1Eligible ? (reduced ? 0.5 : 0.3 + Math.sin(phase * TAU) * 0.25) : 0

  const rings = [
    { value: cov, color: 'var(--accent-teal)', rr: r, label: 'coverage' },
    { value: eng, color: 'var(--accent-indigo)', rr: r * 0.82, label: 'engagement' },
    { value: ea1, color: 'var(--accent-gold)', rr: r * 0.64, label: 'EA-1' },
  ]

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--halo-gold), transparent 68%)',
          transform: `scale(${haloScale})`, opacity: haloOpacity,
          transition: 'opacity 400ms ease', pointerEvents: 'none',
        }}
      />
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: 'relative' }}>
        {rings.map((ring) => (
          <g key={ring.label}>
            <path d={arcPath(cx, cy, ring.rr, a0, a0 + sweep)} fill="none" stroke="var(--stroke-veil)" strokeWidth="10" strokeLinecap="round" />
            <path
              d={arcPath(cx, cy, ring.rr, a0, a0 + sweep * Math.max(0.001, ring.value))}
              fill="none" stroke={ring.color} strokeWidth="10" strokeLinecap="round"
              style={{ transition: 'all 400ms cubic-bezier(0.22,0.61,0.36,1)', filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.4))' }}
            />
          </g>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="var(--font-display)" fontSize={size * 0.16} fill="var(--ink-primary)" fontWeight="600">
          {meditation.region}
        </text>
        <text x={cx} y={cy + size * 0.09} textAnchor="middle" fontFamily="var(--font-ui)" fontSize={size * 0.045} fill="var(--ink-muted)" letterSpacing="0.15em">
          {meditation.overlay}
        </text>
      </svg>
    </div>
  )
}
