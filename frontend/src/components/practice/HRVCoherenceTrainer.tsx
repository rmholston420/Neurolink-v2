import React from 'react'
import { Card } from '../ui/Card'
import { useHRVCoherence } from '../../hooks/useHRVCoherence'
import { makePath } from '../../lib/bandpower.js'
import type { HrvBlock } from '../../lib/wire'

// Coherence trainer: turns the live IBI tachogram into a coherence gauge, a
// rolling coherence/HR trace, and a session score (mean coherence). Renders an
// honest empty state until enough beats have accumulated.

interface Props {
  hrv: HrvBlock | null
}

const TAU = Math.PI * 2

export function HRVCoherenceTrainer({ hrv }: Props) {
  const ibi = hrv?.ibi_ms ?? null
  const { coherence, history, score, hr } = useHRVCoherence(ibi)

  const size = 160
  const cx = size / 2
  const r = size * 0.4
  const dash = TAU * r
  const filled = dash * coherence

  const w = 280
  const h = 60
  const cohPath =
    history.length > 1
      ? makePath(history.map((s, i) => ({ x: i, y: s.coherence })), w, h, 0, 1)
      : ''

  const hasData = ibi != null && ibi.length >= 8

  return (
    <Card title="HRV coherence trainer" subtitle="Heart-rhythm concentration from the live IBI stream">
      {!hasData ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>
          Gathering heartbeats… coherence needs ~8 intervals (about 10–15 s of PPG).
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="coherence gauge">
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--stroke-veil)" strokeWidth="12" />
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke="var(--accent-gold)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${dash - filled}`}
              transform={`rotate(-90 ${cx} ${cx})`}
              style={{ transition: 'stroke-dasharray 300ms ease' }}
            />
            <text x={cx} y={cx - 2} textAnchor="middle" fontFamily="var(--font-display)" fontSize={size * 0.24} fill="var(--ink-primary)">
              {(coherence * 100).toFixed(0)}
            </text>
            <text x={cx} y={cx + size * 0.16} textAnchor="middle" fontFamily="var(--font-ui)" fontSize={size * 0.08} fill="var(--ink-muted)" letterSpacing="0.15em">
              COHERENCE
            </text>
          </svg>

          <div style={{ flex: 1, minWidth: 220 }}>
            {cohPath && (
              <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="coherence trend">
                <path d={cohPath} fill="none" stroke="var(--accent-teal)" strokeWidth="2" />
              </svg>
            )}
            <dl className="font-mono" style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13 }}>
              <dt className="nl-muted">Heart rate</dt>
              <dd style={{ margin: 0, textAlign: 'right' }}>{hr == null ? '—' : `${hr} bpm`}</dd>
              <dt className="nl-muted">Session score</dt>
              <dd style={{ margin: 0, textAlign: 'right' }}>{(score * 100).toFixed(0)}%</dd>
              <dt className="nl-muted">Samples</dt>
              <dd style={{ margin: 0, textAlign: 'right' }}>{history.length}</dd>
            </dl>
          </div>
        </div>
      )}
    </Card>
  )
}
