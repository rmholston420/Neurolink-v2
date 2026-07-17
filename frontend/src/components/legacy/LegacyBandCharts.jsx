// Legacy per-channel + band chart components extracted verbatim from the
// original main.jsx (Commit-1 split). Behaviour is unchanged.
import React from 'react'
import {
  BAND_NAMES,
  BAND_COLORS,
  clamp01,
  buildBandSeries,
  getChartRange,
  makePath,
} from '../../lib/bandpower.js'
import { detailChipBase, QUALITY_STYLES } from './legacyStyles.js'
import { formatQualityLabel } from '../../lib/bandpower.js'

export function OperatorChannelCard({ channelKey, channelNames, bands, quality }) {
  const numericKey = Number(channelKey)
  const label =
    Number.isInteger(numericKey)
      ? (numericKey > 0 ? channelNames?.[numericKey - 1] : undefined) ??
        channelNames?.[numericKey] ??
        `Channel ${channelKey}`
      : channelNames?.[channelKey] ?? `Channel ${channelKey}`
  const qualityStatus = quality?.status || 'unknown'
  const qualityReason = quality?.reason || 'No classification yet'
  const qualityGuidance = quality?.guidance || ''
  const style = QUALITY_STYLES[qualityStatus] || QUALITY_STYLES.unknown

  return (
    <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ color: '#e8eefc', fontWeight: 700 }}>{label}</div>
          <div style={{ color: '#9eb0d1', fontSize: 12 }}>channel {String(channelKey)}</div>
        </div>
        <div
          title={qualityReason}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999,
            background: style.bg, border: `1px solid ${style.border}`, color: style.color,
            fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
          }}
        >
          {formatQualityLabel(qualityStatus)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 8 }}>
        {BAND_NAMES.map((bandName) => (
          <div key={bandName} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(158,176,209,0.10)', borderRadius: 10, padding: 8 }}>
            <div style={{ color: BAND_COLORS[bandName], fontSize: 12, textTransform: 'capitalize', marginBottom: 4 }}>{bandName}</div>
            <div style={{ color: '#e8eefc', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {clamp01(bands?.[bandName] ?? 0).toFixed(3)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, color: '#9eb0d1', fontSize: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ ...detailChipBase, color: '#c9d7f2', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(158,176,209,0.14)' }}>
            Reason: {qualityReason}
          </span>
        </div>
        {qualityGuidance ? (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(158,176,209,0.12)', color: '#dbe7ff', lineHeight: 1.4 }}>
            <span style={{ color: '#9eb0d1', display: 'block', marginBottom: 4 }}>Operator guidance</span>
            {qualityGuidance}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function QualityBadge({ quality }) {
  const status = quality?.status || 'unknown'
  const reason = quality?.reason || 'No classification yet'
  const style = QUALITY_STYLES[status] || QUALITY_STYLES.unknown

  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999,
        background: style.bg, border: `1px solid ${style.border}`, color: style.color, fontSize: 12, fontWeight: 700,
      }}
      title={reason}
    >
      <span>{style.label}</span>
    </div>
  )
}

export function BandTrendCard({ bandName, history }) {
  const width = 180
  const height = 56
  const points = buildBandSeries(history, bandName)
  const { min, max } = getChartRange(history, [bandName])
  const d = makePath(points, width, height, min, max)
  const latest = history.length ? clamp01(history[history.length - 1]?.[bandName] ?? 0) : 0
  const earlierIndex = history.length > 6 ? history.length - 6 : 0
  const earlier = history.length ? clamp01(history[earlierIndex]?.[bandName] ?? 0) : 0
  const delta = latest - earlier
  const trend = delta > 0.02 ? 'rising' : delta < -0.02 ? 'falling' : 'steady'

  return (
    <div style={{ background: '#0b1220', border: '1px solid rgba(158,176,209,0.14)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ color: '#c9d7f2', textTransform: 'capitalize', fontWeight: 600 }}>{bandName}</span>
        <span style={{ color: BAND_COLORS[bandName], fontVariantNumeric: 'tabular-nums' }}>{latest.toFixed(3)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d={d} fill="none" stroke={BAND_COLORS[bandName]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#9eb0d1', fontSize: 12 }}>
        <span>{trend}</span>
        <span>{min.toFixed(3)}–{max.toFixed(3)}</span>
      </div>
    </div>
  )
}

export function BandPowerChart({ history, selectedBand, onSelectBand }) {
  const width = 520
  const height = 220
  const bandNames = BAND_NAMES
  const latestEntry = history[history.length - 1] || null

  if (!history.length) {
    return <p>No band-power history yet</p>
  }

  const focusBand = bandNames.includes(selectedBand) ? selectedBand : 'alpha'
  const { min, max } = getChartRange(history, [focusBand])

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', background: '#0b1220', borderRadius: 10, border: '1px solid rgba(158,176,209,0.18)' }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((level) => {
          const y = level * height
          return <line key={level} x1="0" y1={y} x2={width} y2={y} stroke="rgba(158,176,209,0.14)" strokeWidth="1" />
        })}

        {bandNames.map((bandName) => {
          const points = buildBandSeries(history, bandName)
          const d = makePath(points, width, height, min, max)
          const isFocused = bandName === focusBand
          return (
            <path
              key={bandName} d={d} fill="none" stroke={BAND_COLORS[bandName]}
              strokeWidth={isFocused ? '3.5' : '1.25'} strokeOpacity={isFocused ? '1' : '0.18'}
              strokeLinecap="round" strokeLinejoin="round"
            />
          )
        })}

        <text x="8" y="18" fill="#9eb0d1" fontSize="12">max {max.toFixed(3)}</text>
        <text x="8" y={height - 8} fill="#9eb0d1" fontSize="12">min {min.toFixed(3)}</text>
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {bandNames.map((bandName) => {
          const isFocused = bandName === focusBand
          return (
            <button
              key={bandName}
              onClick={() => onSelectBand(bandName)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 999,
                border: isFocused ? `1px solid ${BAND_COLORS[bandName]}` : '1px solid rgba(158,176,209,0.18)',
                background: isFocused ? 'rgba(255,255,255,0.06)' : 'transparent', color: '#c9d7f2',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: BAND_COLORS[bandName], display: 'inline-block' }} />
              <span>{bandName}{latestEntry ? `: ${clamp01(latestEntry?.[bandName] ?? 0).toFixed(3)}` : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
