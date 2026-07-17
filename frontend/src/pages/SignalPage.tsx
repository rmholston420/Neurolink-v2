import React from 'react'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'
import { Card } from '../components/ui/Card'
import { getChannelLabel, BAND_NAMES, BAND_COLORS } from '../lib/bandpower.js'

// Signal is the instrumentation view: per-channel band powers and contact
// quality straight from the live EEG frame. Richer charts (spectrogram, topo)
// land in later tiers; this page keeps every value bound to a real frame.
export function SignalPage({ store }: { store: NeurolinkStore }) {
  const { flattenedBands, channelNames, bandQuality } = store
  const channels = Object.entries(flattenedBands)

  return (
    <div className="nl-page nl-page-signal">
      <Card title="Band powers" subtitle="Per-channel, live from the stream">
        {channels.length === 0 ? (
          <p className="nl-muted">No live signal yet. Start the stream to populate.</p>
        ) : (
          <div className="nl-grid-2">
            {channels.map(([key, bands]) => (
              <div key={key} className="nl-band-card">
                <div className="nl-whisper" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  {getChannelLabel(key, channelNames)}
                </div>
                <dl className="font-mono" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontSize: 13 }}>
                  {BAND_NAMES.map((b) => (
                    <React.Fragment key={b}>
                      <dt style={{ color: BAND_COLORS[b] }}>{b}</dt>
                      <dd style={{ margin: 0, textAlign: 'right', color: 'var(--ink-muted)' }}>
                        {(Number((bands as Record<string, number>)[b]) || 0).toFixed(3)}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Contact quality" subtitle="Per-channel status">
        {Object.keys(bandQuality).length === 0 ? (
          <p className="nl-muted">No quality data yet.</p>
        ) : (
          <dl className="font-mono" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13 }}>
            {Object.entries(bandQuality).map(([key, q]) => (
              <React.Fragment key={key}>
                <dt>{getChannelLabel(key, channelNames)}</dt>
                <dd style={{ margin: 0, textAlign: 'right', color: 'var(--ink-muted)' }}>{q?.status ?? 'unknown'}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
      </Card>
    </div>
  )
}
