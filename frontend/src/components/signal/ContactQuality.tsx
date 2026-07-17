import React from 'react'
import { Card } from '../ui/Card'
import { TONE_GOOD, TONE_WARN, TONE_BAD } from '../../lib/vajra'

// ContactQuality — per-electrode contact dots from the live frame `contact`
// map (0–1 score per channel, from frame_metrics.py). Green ≥ 0.6, amber
// ≥ 0.3, maroon below. Falls back to zeros (all maroon) when the frame carries
// no contact map yet — never invents a passing reading.

interface Props {
  contact: Record<string, number>
  channelNames: string[]
}

function tone(score: number): string {
  if (score >= 0.6) return TONE_GOOD
  if (score >= 0.3) return TONE_WARN
  return TONE_BAD
}

function label(score: number): string {
  if (score >= 0.6) return 'good'
  if (score >= 0.3) return 'fair'
  return 'poor'
}

export function ContactQuality({ contact, channelNames }: Props) {
  // Prefer the frame-provided channel labels; fall back to the frontal-4 so the
  // panel always renders four electrodes.
  // TODO: verify Athena channel names
  const fallback = ['TP9', 'AF7', 'AF8', 'TP10']
  const labels = Object.keys(contact).length ? Object.keys(contact) : channelNames.length ? channelNames : fallback

  return (
    <Card title="Contact quality" subtitle="Per-electrode signal contact">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {labels.map((name) => {
          const score = Number(contact[name]) || 0
          const c = tone(score)
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                minWidth: 64,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-shrine-hi)',
                border: '1px solid var(--stroke-veil)',
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: c, boxShadow: `0 0 10px ${c}` }} />
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-primary)' }}>{name}</span>
              <span className="nl-whisper">{label(score)} · {(score * 100).toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
