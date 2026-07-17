import React from 'react'
import { Card } from '../ui/Card'
import { TONE_GOOD, TONE_WARN, TONE_BAD, TONE_PEAK } from '../../lib/vajra'

// FocusFatigueGauge — twin radial gauges for cognitive state.
//
// Focus: state label (HIGH/MOD/LOW/DISTRACTED) + normalized engagement score.
// Fatigue: theta/alpha proxy. Both from frame_metrics.py via the live frame.
// Renders honest placeholders when the frame has not yet supplied values.

interface Props {
  focusState: string | null
  focusScore: number | null
  fatigue: number | null
}

const FOCUS_COLORS: Record<string, string> = {
  HIGH: TONE_GOOD,
  MOD: TONE_WARN,
  LOW: TONE_BAD,
  DISTRACTED: TONE_BAD,
}

const RADIUS = 46
const CIRC = 2 * Math.PI * RADIUS

function Gauge({ value, color, label, caption }: { value: number; color: string; label: string; caption: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg viewBox="0 0 120 120" width={120} height={120} aria-label={`${caption} gauge`}>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--stroke-veil)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - v)}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 300ms ease, stroke 300ms ease' }}
        />
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink-primary)" className="font-mono">
          {(v * 100).toFixed(0)}
        </text>
        <text x="60" y="76" textAnchor="middle" fontSize="10" fill="var(--ink-whisper)">%</text>
      </svg>
      <div style={{ fontWeight: 700, color }}>{label}</div>
      <div className="nl-whisper">{caption}</div>
    </div>
  )
}

export function FocusFatigueGauge({ focusState, focusScore, fatigue }: Props) {
  const hasFocus = focusState != null && focusScore != null
  const hasFatigue = fatigue != null
  const focusColor = hasFocus ? FOCUS_COLORS[focusState] ?? 'var(--ink-whisper)' : 'var(--ink-whisper)'
  const fatigueVal = fatigue ?? 0
  const fatigueColor = fatigueVal > 0.7 ? TONE_BAD : fatigueVal > 0.4 ? TONE_WARN : TONE_GOOD

  return (
    <Card title="Focus & fatigue" subtitle="Engagement index · theta/alpha">
      {!hasFocus && !hasFatigue ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>No state data yet — start the stream.</p>
      ) : (
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Gauge
            value={focusScore ?? 0}
            color={hasFocus ? (focusState === 'HIGH' ? TONE_PEAK : focusColor) : 'var(--ink-whisper)'}
            label={hasFocus ? focusState : '—'}
            caption="focus"
          />
          <Gauge value={fatigueVal} color={fatigueColor} label={hasFatigue ? (fatigueVal > 0.7 ? 'HIGH' : fatigueVal > 0.4 ? 'MOD' : 'LOW') : '—'} caption="fatigue" />
        </div>
      )}
    </Card>
  )
}
