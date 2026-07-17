import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { BREATH_PERIOD_MS, prefersReducedMotion } from '../../theme/motion'
import type { BreathingBlock } from '../../lib/wire'

// Breath pacer at the coherence cadence (5.5 bpm ≈ 10.9 s). "Guided" runs the
// fixed target cadence; "adaptive" paces to the operator's own measured breath
// rate (from frame_hrv.py) so the visual meets them where they are. The ring
// grows on the inhale, holds, and shrinks on the exhale. Reduced-motion drops
// the animation and shows the phase word only.

export type BreathLabel = 'inhale' | 'hold-in' | 'exhale' | 'hold-out'

// Phase boundaries within one 0..1 cycle: inhale 40%, hold 10%, exhale 40%,
// hold 10% — a smooth 4-4 with brief retentions.
export function breathLabel(t: number): BreathLabel {
  const x = ((t % 1) + 1) % 1
  if (x < 0.4) return 'inhale'
  if (x < 0.5) return 'hold-in'
  if (x < 0.9) return 'exhale'
  return 'hold-out'
}

// 0 (fully exhaled) .. 1 (fully inhaled) ring fill for a cycle position.
export function breathScale(t: number): number {
  const x = ((t % 1) + 1) % 1
  if (x < 0.4) return x / 0.4
  if (x < 0.5) return 1
  if (x < 0.9) return 1 - (x - 0.5) / 0.4
  return 0
}

const LABEL_TEXT: Record<BreathLabel, string> = {
  inhale: 'Breathe in',
  'hold-in': 'Hold',
  exhale: 'Breathe out',
  'hold-out': 'Hold',
}

type Mode = 'guided' | 'adaptive'

interface Props {
  breathing: BreathingBlock | null
  coherence?: number
  size?: number
}

export function BreathingPanel({ breathing, coherence, size = 200 }: Props) {
  const [mode, setMode] = useState<Mode>('guided')
  const [phase, setPhase] = useState(0)
  const raf = useRef<number | undefined>(undefined)
  const reduced = prefersReducedMotion()

  // Adaptive cadence follows the measured rate when it's in a sane range.
  const periodMs = useMemo(() => {
    if (mode === 'adaptive' && breathing && breathing.rate_bpm >= 2 && breathing.rate_bpm <= 30) {
      return (60 / breathing.rate_bpm) * 1000
    }
    return BREATH_PERIOD_MS
  }, [mode, breathing])

  useEffect(() => {
    if (reduced) {
      setPhase(0)
      return
    }
    let start: number | null = null
    const loop = (t: number) => {
      if (start === null) start = t
      setPhase(((t - start) % periodMs) / periodMs)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [periodMs, reduced])

  const label = breathLabel(phase)
  const scale = breathScale(phase)
  const cx = size / 2
  const rMin = size * 0.18
  const rMax = size * 0.44
  const r = reduced ? (rMin + rMax) / 2 : rMin + (rMax - rMin) * scale

  return (
    <Card
      title="Breath pacer"
      subtitle={`Coherence cadence · ${(60000 / periodMs).toFixed(1)} bpm`}
      actions={
        <div role="group" aria-label="pacer mode" style={{ display: 'flex', gap: 6 }}>
          {(['guided', 'adaptive'] as Mode[]).map((m) => (
            <button
              key={m}
              className={`nl-btn ${mode === m ? 'nl-btn-primary' : ''}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              style={{ textTransform: 'capitalize' }}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="breath pacer">
          <circle cx={cx} cy={cx} r={rMax} fill="none" stroke="var(--stroke-veil)" strokeWidth="2" />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="var(--halo-gold)"
            stroke="var(--accent-gold)"
            strokeWidth="2"
            style={{ transition: reduced ? undefined : 'r 80ms linear' }}
          />
          <text
            x={cx}
            y={cx + 4}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={size * 0.11}
            fill="var(--ink-primary)"
          >
            {LABEL_TEXT[label]}
          </text>
        </svg>
        <dl
          className="font-mono"
          style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13, width: '100%' }}
        >
          <dt className="nl-muted">Measured rate</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>
            {breathing ? `${breathing.rate_bpm.toFixed(1)} bpm` : '—'}
          </dd>
          <dt className="nl-muted">Phase</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>
            {breathing?.phase_label ?? label}
          </dd>
          <dt className="nl-muted">Coherence</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>
            {coherence == null ? '—' : `${(coherence * 100).toFixed(0)}%`}
          </dd>
        </dl>
        {!breathing && (
          <p className="nl-whisper" style={{ margin: 0 }}>
            Awaiting breath signal — adaptive mode uses the target cadence until then.
          </p>
        )}
      </div>
    </Card>
  )
}
