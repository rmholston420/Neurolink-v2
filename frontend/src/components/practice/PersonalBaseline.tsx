import React from 'react'
import { Card } from '../ui/Card'
import { usePersonalBaseline } from '../../hooks/usePersonalBaseline'
import { BAND_ORDER, BAND_VAR, BAND_GLYPH, type BandName } from '../../lib/vajra'

// Live band powers against the operator's calibrated resting baseline. The bar
// shows the live value; the grey underlay is the baseline, and the signed delta
// tells them which way they've moved from rest.

export function PersonalBaseline({ liveBands }: { liveBands: Record<BandName, number> }) {
  const { baseline, deltas, label, loaded } = usePersonalBaseline(liveBands)

  const max = Math.max(
    0.001,
    ...BAND_ORDER.flatMap((b) => [Number(liveBands[b]) || 0, baseline ? baseline[b] : 0]),
  )

  return (
    <Card
      title="Personal baseline"
      subtitle={label ? `Baseline: ${label}` : 'Live vs resting calibration'}
    >
      {!loaded ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Loading baseline…</p>
      ) : !baseline ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>
          No baseline captured yet. Run a calibration in the meditation flow to compare against rest.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BAND_ORDER.map((b) => {
            const live = Number(liveBands[b]) || 0
            const base = baseline[b]
            const delta = deltas ? deltas[b] : 0
            const sign = delta > 0 ? '+' : ''
            return (
              <div key={b}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="font-mono" style={{ fontSize: 12, color: BAND_VAR[b] }}>{BAND_GLYPH[b]} {b}</span>
                  <span className="font-mono nl-whisper" style={{ fontSize: 11 }}>
                    live {live.toFixed(3)} · Δ {sign}{delta.toFixed(3)}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 10, background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${(base / max) * 100}%`, background: 'var(--stroke-veil)' }} />
                  <div style={{ position: 'absolute', inset: 0, width: `${(live / max) * 100}%`, background: BAND_VAR[b], opacity: 0.85, transition: 'width 240ms ease' }} />
                </div>
              </div>
            )
          })}
          <div className="nl-whisper">Filled bar = live · grey underlay = baseline</div>
        </div>
      )}
    </Card>
  )
}
