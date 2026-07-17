import React, { useEffect, useRef, useState } from 'react'
import { Card, StatusPill } from '../ui/Card'
import { makePath } from '../../lib/bandpower.js'
import type { Ea1Result } from '../../hooks/useNeurolinkStore'
import type { Ea1Criterion } from '../../lib/apiClient'

// Full EA-1 gate readout: per-criterion progress bars, the two hard gates
// (s-space region + head motion), a running eligible-seconds counter, and a
// rolling score timeline. All values come from the shared server-side result.

const CRIT_LABEL: Record<string, string> = {
  hrv_rmssd: 'HRV RMSSD',
  rr_bpm: 'Breath rate',
  faa: 'Frontal α asymmetry',
  fmt: 'Frontal-midline θ',
  poincare_ratio: 'Poincaré SD1/SD2',
}

const HISTORY_CAP = 120

function critFraction(c: Ea1Criterion): number {
  if (c.value == null) return 0
  if (c.range) return c.met ? 1 : 0
  if (c.threshold != null && c.threshold > 0) return Math.max(0, Math.min(1, c.value / c.threshold))
  return c.value > 0 ? 1 : 0
}

function fmtValue(c: Ea1Criterion): string {
  if (c.value == null) return '—'
  const v = Math.abs(c.value) >= 10 ? c.value.toFixed(1) : c.value.toFixed(2)
  return `${v}${c.units ? ` ${c.units}` : ''}`
}

function critTarget(c: Ea1Criterion): string {
  if (c.range) return `${c.range[0]}–${c.range[1]}${c.units ? ` ${c.units}` : ''}`
  if (c.threshold != null) return `≥ ${c.threshold}${c.units ? ` ${c.units}` : ''}`
  return ''
}

export function EA1Score({ ea1 }: { ea1: Ea1Result | null }) {
  const [history, setHistory] = useState<number[]>([])
  const [eligibleSeconds, setEligibleSeconds] = useState(0)
  const eligibleRef = useRef(false)
  eligibleRef.current = Boolean(ea1?.eligible)

  // Append a score sample on each fresh result.
  useEffect(() => {
    if (!ea1) return
    setHistory((prev) => [...prev, ea1.score].slice(-HISTORY_CAP))
  }, [ea1])

  // Accumulate eligible time in whole seconds while the gate is open.
  useEffect(() => {
    const id = setInterval(() => {
      if (eligibleRef.current) setEligibleSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  if (!ea1) {
    return (
      <Card title="EA-1 gate" subtitle="Five criteria · two hard gates">
        <p className="nl-muted" style={{ marginBottom: 0 }}>Awaiting live signal to score EA-1.</p>
      </Card>
    )
  }

  const criteria = Object.entries(ea1.criteria)
  const w = 280
  const h = 50
  const path = history.length > 1 ? makePath(history.map((v, i) => ({ x: i, y: v })), w, h, 0, 1) : ''
  const tone = ea1.eligible ? (ea1.criteria_met >= 4 ? 'good' : 'warn') : 'bad'

  return (
    <Card
      title="EA-1 gate"
      subtitle={`${ea1.criteria_met}/${ea1.criteria_total} criteria · score ${(ea1.score * 100).toFixed(0)}%`}
      actions={<StatusPill tone={tone}>{ea1.label}</StatusPill>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Hard gates */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatusPill tone={ea1.gates.s_space ? 'good' : 'bad'}>
            s-space {ea1.s_space_region} {ea1.gates.s_space ? 'open' : 'closed'}
          </StatusPill>
          <StatusPill tone={ea1.gates.motion ? 'good' : 'bad'}>
            motion {ea1.gates.motion ? 'still' : 'high'}
          </StatusPill>
        </div>

        {/* Criteria bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {criteria.map(([key, c]) => {
            const frac = critFraction(c)
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-primary)' }}>
                    {CRIT_LABEL[key] ?? key}
                  </span>
                  <span className="font-mono nl-whisper" style={{ fontSize: 11 }}>
                    {fmtValue(c)} · target {critTarget(c)}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 8, background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div
                    style={{
                      position: 'absolute', inset: 0, width: `${frac * 100}%`,
                      background: c.met ? 'var(--accent-teal)' : 'var(--accent-maroon)',
                      opacity: 0.9, transition: 'width 300ms ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Eligible seconds + timeline */}
        <dl className="font-mono" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13 }}>
          <dt className="nl-muted">Eligible time accumulated</dt>
          <dd style={{ margin: 0, textAlign: 'right' }}>
            {Math.floor(eligibleSeconds / 60)}:{(eligibleSeconds % 60).toString().padStart(2, '0')}
          </dd>
        </dl>
        {path ? (
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="EA-1 score timeline">
            <path d={path} fill="none" stroke="var(--accent-gold)" strokeWidth="2" />
          </svg>
        ) : (
          <p className="nl-whisper" style={{ margin: 0 }}>Timeline builds as results stream in.</p>
        )}
      </div>
    </Card>
  )
}
