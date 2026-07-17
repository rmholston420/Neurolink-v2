import React, { useEffect, useRef, useState } from 'react'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'
import { NeurofeedbackGauge } from '../components/practice/NeurofeedbackGauge'
import { Card } from '../components/ui/Card'
import { MeditationPanel as MeditationPanelBase } from '../components/MeditationPanel.jsx'

const MeditationPanel = MeditationPanelBase as React.FC<{ bands: Record<string, number>; faa: number | null }>
import { PracticeTracker } from '../components/practice/PracticeTracker'
import { meditationApi, type MeditationClassifyResult } from '../lib/apiClient'

// Practice is the meditation-first home. The hero gauge fuses coverage,
// engagement, and EA-1 progress; EA-1 eligibility is classified server-side off
// the live band means so the gold breath halo only lights on a real result.
export function PracticePage({ store }: { store: NeurolinkStore }) {
  const { meditation, frames } = store
  const [ea1, setEa1] = useState<MeditationClassifyResult['ea1_result'] | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!frames.eeg || inFlight.current) return
    inFlight.current = true
    const b = meditation.bands
    meditationApi
      .classify({
        alpha: b.alpha, theta: b.theta, beta: b.beta,
        delta: b.delta, gamma: b.gamma, faa: meditation.faa ?? 0,
      })
      .then((r) => setEa1(r.ea1_result))
      .catch(() => { /* backend offline; leave prior */ })
      .finally(() => { inFlight.current = false })
  }, [frames.eeg])

  const eligible = Boolean(ea1?.eligible)
  const score = ea1 ? ea1.score : meditation.coverage

  return (
    <div className="nl-page nl-page-practice">
      <div className="nl-hero">
        <NeurofeedbackGauge meditation={meditation} ea1Eligible={eligible} ea1Score={score} />
        <div className="nl-hero-caption">
          <div className="nl-whisper" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            {meditation.stage}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink-primary)' }}>
            {ea1?.label || 'Settle in'}
          </div>
          {ea1 ? (
            <div className="nl-muted font-mono" style={{ fontSize: 13 }}>
              EA-1 {ea1.criteria_met}/{ea1.criteria_total} criteria · score {(score * 100).toFixed(0)}%
            </div>
          ) : (
            <div className="nl-muted font-mono" style={{ fontSize: 13 }}>Awaiting live signal…</div>
          )}
        </div>
      </div>

      <div className="nl-grid-2">
        <Card title="Meditation state" subtitle="Derived from live band powers">
          <MeditationPanel bands={meditation.bands} faa={meditation.faa} />
        </Card>
        <Card title="Session focus" subtitle="Engagement & integration">
          <dl className="font-mono" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, fontSize: 14 }}>
            <dt className="nl-muted">Region</dt><dd style={{ margin: 0, textAlign: 'right' }}>{meditation.region}</dd>
            <dt className="nl-muted">Overlay</dt><dd style={{ margin: 0, textAlign: 'right' }}>{meditation.overlay}</dd>
            <dt className="nl-muted">Engagement</dt><dd style={{ margin: 0, textAlign: 'right' }}>{(meditation.engagement * 100).toFixed(0)}%</dd>
            <dt className="nl-muted">Coverage</dt><dd style={{ margin: 0, textAlign: 'right' }}>{(meditation.coverage * 100).toFixed(0)}%</dd>
            <dt className="nl-muted">FAA</dt><dd style={{ margin: 0, textAlign: 'right' }}>{meditation.faa == null ? '—' : meditation.faa.toFixed(3)}</dd>
          </dl>
        </Card>
      </div>

      <PracticeTracker coverage={meditation.coverage} />
    </div>
  )
}
