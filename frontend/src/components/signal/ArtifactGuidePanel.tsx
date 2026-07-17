import React from 'react'
import { Card, StatusPill } from '../ui/Card'
import { TONE_GOOD, TONE_BAD, TONE_WARN } from '../../lib/vajra'
import type { ArtifactScores } from '../../lib/wire'

// ArtifactGuidePanel — real-time coaching for the five artifact classes the
// Stage-3b detector reports (frame_metrics.summarize_artifacts). Each class
// shows its live max-confidence [0,1] this frame and a one-line remedy. A class
// is "active" (maroon) once its confidence clears the coaching threshold,
// otherwise it reads clean (teal). Nothing is shown until a frame carries the
// artifacts payload — no fabricated all-clean state.

interface Props {
  artifacts?: ArtifactScores
}

interface Guide {
  key: keyof Omit<ArtifactScores, 'score'>
  label: string
  glyph: string
  remedy: string
}

const GUIDES: Guide[] = [
  { key: 'blink', label: 'Blink / EOG', glyph: '𓂀', remedy: 'Soften the gaze and let the eyes rest half-closed.' },
  { key: 'emg', label: 'Muscle (EMG)', glyph: '〰', remedy: 'Unclench the jaw; drop the shoulders and tongue.' },
  { key: 'movement', label: 'Movement', glyph: '⤧', remedy: 'Settle the head and spine; hold a still posture.' },
  { key: 'saturation', label: 'Electrode pop', glyph: '⚡', remedy: 'Reseat the band; check contact on the flagged site.' },
  { key: 'drift', label: 'Drift / line', glyph: '≈', remedy: 'Move away from mains/cables; let the baseline settle.' },
]

// Confidence at/above this reads as an active artifact worth coaching on.
const ACTIVE = 0.5

export function ArtifactGuidePanel({ artifacts }: Props) {
  if (!artifacts) {
    return (
      <Card title="Artifact Guide" subtitle="Real-time signal-hygiene coaching">
        <p className="nl-muted" style={{ marginBottom: 0 }}>
          Insufficient data — start the stream for live artifact coaching.
        </p>
      </Card>
    )
  }

  const worst = artifacts.score
  const clean = worst < ACTIVE

  return (
    <Card
      title="Artifact Guide"
      subtitle="Real-time signal-hygiene coaching · Stage-3b classifier"
      actions={<StatusPill tone={clean ? 'good' : 'bad'}>{clean ? 'signal clean' : 'artifact active'}</StatusPill>}
    >
      <div className="nl-stack" style={{ gap: 8 }}>
        {GUIDES.map((g) => {
          const conf = artifacts[g.key] ?? 0
          const active = conf >= ACTIVE
          const partial = !active && conf > 0
          const color = active ? TONE_BAD : partial ? TONE_WARN : TONE_GOOD
          return (
            <div
              key={g.key}
              style={{
                background: 'var(--bg-void)',
                border: `1px solid ${active ? color : 'var(--stroke-veil)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span aria-hidden style={{ fontSize: 16, color }}>{g.glyph}</span>
                  <span style={{ fontWeight: 600 }}>{g.label}</span>
                </div>
                <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color }}>
                  {Math.round(conf * 100)}%
                </span>
              </div>
              <div style={{ height: 4, background: 'var(--stroke-veil)', borderRadius: 2, overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ height: '100%', width: `${Math.min(conf * 100, 100)}%`, background: color, borderRadius: 2, transition: 'width 300ms ease' }} />
              </div>
              {active ? (
                <p className="nl-whisper" style={{ margin: 0, color }}>{g.remedy}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
