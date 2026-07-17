import React from 'react'
import { Card } from '../ui/Card'
import { BAND_NAMES, BAND_COLORS, buildBandSeries, getChartRange, makePath } from '../../lib/bandpower.js'

// Rolling band-power trend for the primary channel, driven by the store's
// bandHistory (last 60 frames). One SVG line per band, colored by the shared
// band palette. Pure/props-driven so it renders from real frames only.
export function BandTrend({ history }: { history: Array<Record<string, number>> }) {
  const w = 520
  const h = 160
  const { min, max } = getChartRange(history, BAND_NAMES)

  return (
    <Card title="Band trend" subtitle="Primary channel · last 60 frames">
      {history.length < 2 ? (
        <p className="nl-muted">Streaming data will populate the trend.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="Band power trend">
            {BAND_NAMES.map((band) => {
              const series = buildBandSeries(history, band)
              return (
                <path
                  key={band}
                  d={makePath(series, w, h, min, max)}
                  fill="none"
                  stroke={(BAND_COLORS as Record<string, string>)[band]}
                  strokeWidth="2"
                />
              )
            })}
          </svg>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
            {BAND_NAMES.map((band) => (
              <span key={band} className="font-mono" style={{ fontSize: 12, color: (BAND_COLORS as Record<string, string>)[band] }}>
                ● {band}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
