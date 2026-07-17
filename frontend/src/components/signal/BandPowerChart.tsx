import React from 'react'
import { Card } from '../ui/Card'
import { BAND_ORDER, BAND_VAR, BAND_GLYPH, type BandName } from '../../lib/vajra'

// BandPowerChart — live per-band horizontal bars for every channel.
//
// One column per channel, five band bars each, colored by the shared Vajra
// band tokens with a 240 ms width easing. Fully props-driven; renders only the
// channels present in the live frame.

interface Props {
  channelBands: Record<string, Partial<Record<BandName, number>>>
}

export function BandPowerChart({ channelBands }: Props) {
  const entries = Object.entries(channelBands)

  return (
    <Card title="Band powers" subtitle="Per-channel · live from the stream">
      {entries.length === 0 ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>No live signal yet. Start the stream to populate.</p>
      ) : (
        <div className="nl-grid-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {entries.map(([label, bands]) => (
            <div key={label} className="nl-band-card">
              <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {BAND_ORDER.map((b) => {
                  const value = Number(bands?.[b]) || 0
                  const pct = Math.min(100, value * 100)
                  return (
                    <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="font-mono" style={{ width: 54, fontSize: 12, color: BAND_VAR[b] }}>
                        {BAND_GLYPH[b]} {b}
                      </span>
                      <div style={{ flex: 1, height: 16, background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct.toFixed(1)}%`,
                            background: BAND_VAR[b],
                            borderRadius: 'var(--radius-sm)',
                            transition: 'width 240ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                          }}
                        />
                      </div>
                      <span className="font-mono" style={{ width: 44, textAlign: 'right', fontSize: 12, color: 'var(--ink-muted)' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
