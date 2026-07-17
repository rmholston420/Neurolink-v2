import React, { useMemo } from 'react'
import { Card } from '../ui/Card'
import { TONE_GOOD, TONE_WARN, TONE_BAD } from '../../lib/vajra'

// ImpedancePanel — per-electrode impedance (kΩ) from the live frame `impedance`
// map. Athena exposes no direct impedance channel, so these are the backend's
// explicit RMS-derived heuristic estimates (frame_metrics.py) — labelled as
// estimates here, never presented as a hardware reading. A channel is flagged
// when it exceeds median + 1.5×IQR (upper fence only).

interface Props {
  impedance: Record<string, number>
}

const GOOD_KO = 20
const BAD_KO = 50
const MAX_BAR = 250

function tone(kohm: number): string {
  if (kohm < GOOD_KO) return TONE_GOOD
  if (kohm < BAD_KO) return TONE_WARN
  return TONE_BAD
}

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function iqr(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  const q1 = median(s.slice(0, Math.floor(s.length / 2)))
  const q3 = median(s.slice(Math.ceil(s.length / 2)))
  return q3 - q1
}

export function ImpedancePanel({ impedance }: Props) {
  const entries = useMemo(
    () => Object.entries(impedance).sort(([a], [b]) => a.localeCompare(b)),
    [impedance],
  )
  const values = entries.map(([, v]) => v)
  const { fence, med } = useMemo(() => {
    if (values.length < 2) return { fence: Infinity, med: values[0] ?? 0 }
    const m = median(values)
    return { fence: m + 1.5 * iqr(values), med: m }
  }, [values])

  return (
    <Card title="Impedance" subtitle="Per-electrode estimate (kΩ) · heuristic proxy">
      {entries.length === 0 ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>No impedance estimate yet — start the stream.</p>
      ) : (
        <>
          <div className="nl-grid-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {entries.map(([ch, kohm]) => {
              const color = tone(kohm)
              const outlier = kohm > fence
              const pct = Math.min((kohm / MAX_BAR) * 100, 100)
              return (
                <div
                  key={ch}
                  style={{
                    background: 'var(--bg-void)',
                    border: `1px solid ${outlier ? 'var(--accent-saffron)' : 'var(--stroke-veil)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    position: 'relative',
                  }}
                >
                  {outlier && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 11, color: 'var(--accent-saffron)' }}>outlier</span>}
                  <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{ch}</div>
                  <div className="font-mono" style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color }}>{kohm.toFixed(1)}</span>
                    <span className="nl-whisper">kΩ</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--stroke-veil)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 350ms ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="font-mono nl-muted" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--stroke-veil)', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>median {med.toFixed(1)} kΩ</span>
            <span>fence {fence === Infinity ? '—' : `${fence.toFixed(1)} kΩ`}</span>
          </div>
        </>
      )}
    </Card>
  )
}
