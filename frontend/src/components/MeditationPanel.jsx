import React, { useMemo } from 'react'
import {
  alchemicalStage,
  engagementIndex,
  integrationCoverage,
  overlayMode,
  sSpaceRegion,
} from './sSpace.js'

// Presentational panel that derives the meditation-domain state (s-space region,
// alchemical stage, overlay mode, engagement, integration coverage) from the
// latest EEG band powers. Pure/props-driven so it can be unit-tested in isolation.
export function MeditationPanel({ bands = {}, faa = null }) {
  const alpha = Number(bands.alpha) || 0
  const theta = Number(bands.theta) || 0
  const beta = Number(bands.beta) || 0

  const derived = useMemo(() => {
    const region = sSpaceRegion(alpha, theta)
    const eng = engagementIndex(alpha, theta, beta)
    return {
      region,
      stage: alchemicalStage(region),
      overlay: overlayMode(region),
      engagement: eng,
      coverage: integrationCoverage(region, eng, faa),
    }
  }, [alpha, theta, beta, faa])

  const pct = (v) => `${Math.round(v * 100)}%`

  return (
    <section
      aria-label="Meditation state"
      style={{
        background: '#131c31',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        color: '#e5eefc',
      }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Meditation State</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Metric label="S-space region" value={derived.region} />
        <Metric label="Alchemical stage" value={derived.stage} />
        <Metric label="Overlay" value={derived.overlay} />
        <Metric label="Engagement" value={pct(derived.engagement)} />
        <Metric label="Integration" value={pct(derived.coverage)} />
      </div>
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 11, color: '#9eb0d1', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

export default MeditationPanel
