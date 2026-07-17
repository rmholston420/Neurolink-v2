import React, { useMemo } from 'react'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'
import { NeurofeedbackGauge } from '../components/practice/NeurofeedbackGauge'
import { Card } from '../components/ui/Card'
import { MeditationPanel as MeditationPanelBase } from '../components/MeditationPanel.jsx'

const MeditationPanel = MeditationPanelBase as React.FC<{ bands: Record<string, number>; faa: number | null }>
import { PracticeTracker } from '../components/practice/PracticeTracker'
import { HRVCoherenceTrainer } from '../components/practice/HRVCoherenceTrainer'
import { BreathingPanel } from '../components/practice/BreathingPanel'
import { MeditationTimer } from '../components/practice/MeditationTimer'
import { EA1Score } from '../components/practice/EA1Score'
import { AlchemicalJournal } from '../components/practice/AlchemicalJournal'
import { WanderingLog } from '../components/practice/WanderingLog'
import { SessionGoals } from '../components/practice/SessionGoals'
import { PersonalBaseline } from '../components/practice/PersonalBaseline'
import { SSpaceDisplay } from '../components/practice/SSpaceDisplay'
import { AudioFeedbackPanel } from '../components/practice/AudioFeedbackPanel'
import { FitCheckBanner } from '../components/signal/FitCheckOverlay'
import { useHRVCoherence } from '../hooks/useHRVCoherence'
import { useAudioFeedback } from '../hooks/useAudioFeedback'
import { BREATH_PERIOD_MS } from '../theme/motion'
import type { BandName } from '../lib/vajra'

// Practice is the meditation-first home. The hero gauge fuses coverage,
// engagement, and EA-1 progress (classified server-side in the store so the
// gold breath halo only lights on a real result). Every Tier-B instrument lives
// here as a first-class citizen wired to live store data.
export function PracticePage({ store, onGoToSignal }: { store: NeurolinkStore; onGoToSignal?: () => void }) {
  const { meditation, hrv, breathing, ea1, poorFit, signalMode } = store
  const rawMode = signalMode !== 'meditation'
  const audio = useAudioFeedback()
  const { coherence } = useHRVCoherence(hrv?.ibi_ms ?? null)

  const eligible = Boolean(ea1?.eligible)
  const score = ea1 ? ea1.score : meditation.coverage
  const breathPeriodMs =
    breathing && breathing.rate_bpm >= 2 && breathing.rate_bpm <= 30
      ? (60 / breathing.rate_bpm) * 1000
      : BREATH_PERIOD_MS

  const liveBands = meditation.bands as Record<BandName, number>
  const wanderingVector = useMemo(
    () => [meditation.bands.alpha, meditation.bands.theta, meditation.bands.beta, meditation.bands.delta, meditation.bands.gamma, meditation.engagement],
    [meditation],
  )

  return (
    <div className="nl-page nl-page-practice">
      <FitCheckBanner active={poorFit} onGoToSignal={onGoToSignal} />
      {rawMode && (
        <div
          role="alert"
          style={{
            padding: '12px 16px', borderRadius: 8,
            background: 'rgba(232,90,79,0.12)', border: '1px solid var(--accent-fire)',
            color: 'var(--ink-primary)', fontSize: 'var(--fs-14)',
          }}
        >
          Raw signal mode active — meditation features are disabled. Switch to Meditation mode in the top nav to resume practice.
        </div>
      )}
      <div
        className="nl-stack"
        aria-hidden={rawMode}
        style={rawMode ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
      >
      <div className="nl-hero">
        <NeurofeedbackGauge meditation={meditation} ea1Eligible={eligible} ea1Score={score} breathPeriodMs={breathPeriodMs} />
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
        <SSpaceDisplay alpha={meditation.bands.alpha} theta={meditation.bands.theta} region={meditation.region} stage={meditation.stage} />
      </div>

      <div className="nl-grid-2">
        <EA1Score ea1={ea1} />
        <HRVCoherenceTrainer hrv={hrv} />
      </div>

      <div className="nl-grid-2">
        <BreathingPanel breathing={breathing} coherence={coherence} />
        <MeditationTimer />
      </div>

      <div className="nl-grid-2">
        <PersonalBaseline liveBands={liveBands} />
        <AudioFeedbackPanel audio={audio} />
      </div>

      <div className="nl-grid-2">
        <SessionGoals />
        <WanderingLog vector={wanderingVector} />
      </div>

      <AlchemicalJournal stage={meditation.stage} region={meditation.region} />

      <PracticeTracker coverage={meditation.coverage} />
      </div>
    </div>
  )
}
