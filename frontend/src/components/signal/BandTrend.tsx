import React from 'react'
import { Card } from '../ui/Card'
import { buildBandSeries, getChartRange, makePath } from '../../lib/bandpower.js'
import { BAND_ORDER, BAND_VAR, BAND_HEX, BAND_GLYPH } from '../../lib/vajra'

// Rolling band-power trend for the primary channel, driven by the store's
// bandHistory (last 60 frames). One SVG line per band, colored by the shared
// Vajra band tokens, over a faint reference grid. Pure/props-driven.
export function BandTrend({ history }: { history: Array<Record<string, number>> }) {
  const w = 520
  const h = 160
  const { min, max } = getChartRange(history, BAND_ORDER as unknown as string[])
  const gridLines = [0.25, 0.5, 0.75]

  return (
    <Card title="Band trend" subtitle="Primary channel · last 60 frames">
      {history.length < 2 ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Streaming data will populate the trend.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="Band power trend">
            {gridLines.map((g) => (
              <line
                key={g}
                x1={0}
                x2={w}
                y1={h - g * h}
                y2={h - g * h}
                stroke="var(--stroke-veil)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            ))}
            {BAND_ORDER.map((band) => {
              const series = buildBandSeries(history, band)
              return (
                <path key={band} d={makePath(series, w, h, min, max)} fill="none" stroke={BAND_HEX[band]} strokeWidth="2" />
              )
            })}
          </svg>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
            {BAND_ORDER.map((band) => (
              <span key={band} className="font-mono" style={{ fontSize: 12, color: BAND_VAR[band] }}>
                {BAND_GLYPH[band]} {band}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
