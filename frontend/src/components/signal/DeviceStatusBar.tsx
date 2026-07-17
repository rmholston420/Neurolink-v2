import React from 'react'
import { TONE_GOOD, TONE_WARN, TONE_BAD } from '../../lib/vajra'

// DeviceStatusBar — compact in-page status strip for the Signal view.
//
// The persistent right-rail DeviceRail owns the always-on device summary; this
// is the horizontal in-page variant (battery segments, signal bars, source
// badge) that sits atop the Signal grid. Mean contact score drives the signal
// bars, from the live frame `contact` map.

interface Props {
  battery: number | null
  contactMean: number | null
  source: string | null
  connected: boolean
}

function batteryColor(pct: number): string {
  if (pct <= 15) return TONE_BAD
  if (pct <= 35) return TONE_WARN
  return TONE_GOOD
}

function signalColor(q: number): string {
  if (q >= 0.75) return TONE_GOOD
  if (q >= 0.4) return TONE_WARN
  return TONE_BAD
}

function BatteryBar({ pct }: { pct: number | null }) {
  const SEGMENTS = 5
  const filled = pct !== null ? Math.round((pct / 100) * SEGMENTS) : 0
  const color = pct !== null ? batteryColor(pct) : 'var(--ink-whisper)'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} title={pct !== null ? `Battery ${pct}%` : 'Battery unavailable'}>
      <div style={{ display: 'inline-flex', gap: 2, padding: '2px 3px', border: '1px solid var(--stroke-veil)', borderRadius: 4 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div key={i} style={{ width: 5, height: 11, borderRadius: 2, background: i < filled ? color : 'var(--stroke-veil)', transition: 'background 400ms ease' }} />
        ))}
      </div>
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color }}>{pct !== null ? `${pct.toFixed(0)}%` : '—'}</span>
    </div>
  )
}

function SignalBars({ quality }: { quality: number | null }) {
  const BARS = 4
  const filled = quality === null ? 0 : Math.max(1, Math.round(quality * BARS))
  const color = quality !== null ? signalColor(quality) : 'var(--ink-whisper)'
  const label = quality !== null ? (quality >= 0.75 ? 'Good' : quality >= 0.4 ? 'Fair' : 'Poor') : 'No data'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }} title={`Signal ${label}`}>
      <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2 }}>
        {Array.from({ length: BARS }, (_, i) => (
          <div key={i} style={{ width: 4, height: 5 + i * 3, borderRadius: 2, background: quality !== null && i < filled ? color : 'var(--stroke-veil)', alignSelf: 'flex-end', transition: 'background 400ms ease' }} />
        ))}
      </div>
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color, marginLeft: 5 }}>{label}</span>
    </div>
  )
}

export function DeviceStatusBar({ battery, contactMean, source, connected }: Props) {
  const divider = <div style={{ width: 1, height: 14, background: 'var(--stroke-veil)' }} />
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '7px 14px',
        background: 'var(--bg-shrine)',
        border: '1px solid var(--stroke-veil)',
        borderRadius: 'var(--radius-pill)',
      }}
    >
      <BatteryBar pct={battery} />
      {divider}
      <SignalBars quality={contactMean} />
      {source && connected && (
        <>
          {divider}
          <span className="nl-pill" style={{ fontSize: 11 }}>{source}</span>
        </>
      )}
    </div>
  )
}
