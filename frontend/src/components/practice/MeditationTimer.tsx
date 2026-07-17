import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { useAudioFeedback } from '../../hooks/useAudioFeedback'
import { useBaselineBell } from '../../hooks/useBaselineBell'
import type { TimerPhase } from '../../lib/types'

// Ceremonial session timer. A run passes through settling → main → dedication,
// each opened by a soft chime; during the main phase a recurring "return to
// baseline" bell rings. Pause/resume/end are always available.

const DURATION_OPTIONS = [5, 10, 20, 30, 45] // minutes
const BELL_INTERVAL_MS = 120_000 // return-to-baseline bell during main phase

// Phase boundaries: a short settling head and dedication tail bracket the main
// body. Both caps keep short sessions sane (never more than 60 s each).
export function timerPhase(elapsedSec: number, totalSec: number): TimerPhase {
  if (elapsedSec >= totalSec) return 'complete'
  const settle = Math.min(60, totalSec * 0.15)
  const dedicate = Math.min(60, totalSec * 0.1)
  if (elapsedSec < settle) return 'settling'
  if (elapsedSec >= totalSec - dedicate) return 'dedication'
  return 'main'
}

const PHASE_CHIME: Record<TimerPhase, number> = {
  settling: -5,
  main: 0,
  dedication: 4,
  complete: 7,
}

const PHASE_LABEL: Record<TimerPhase, string> = {
  settling: 'Settling',
  main: 'Main practice',
  dedication: 'Dedication',
  complete: 'Complete',
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MeditationTimer() {
  const [durationMin, setDurationMin] = useState(20)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const audio = useAudioFeedback()
  const lastPhaseRef = useRef<TimerPhase | null>(null)

  const totalSec = durationMin * 60
  const phase = useMemo(() => (running ? timerPhase(elapsed, totalSec) : 'settling'), [running, elapsed, totalSec])

  // Tick once per second while active.
  useEffect(() => {
    if (!running || paused) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [running, paused])

  // Chime on each phase transition (including completion), then auto-stop.
  useEffect(() => {
    if (!running) return
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase
      audio.playChime(PHASE_CHIME[phase])
      if (phase === 'complete') {
        setRunning(false)
        setPaused(false)
      }
    }
  }, [phase, running, audio])

  // Return-to-baseline bell only during the main phase.
  useBaselineBell({
    enabled: running && !paused && phase === 'main',
    intervalMs: BELL_INTERVAL_MS,
    onRing: useCallback(() => audio.playChime(0), [audio]),
  })

  const start = useCallback(() => {
    setElapsed(0)
    lastPhaseRef.current = null
    setPaused(false)
    setRunning(true)
    audio.playChime(PHASE_CHIME.settling)
  }, [audio])

  const end = useCallback(() => {
    setRunning(false)
    setPaused(false)
    setElapsed(0)
    lastPhaseRef.current = null
  }, [])

  const remaining = Math.max(0, totalSec - elapsed)
  const progress = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 0

  return (
    <Card title="Meditation timer" subtitle="Settling · main · dedication">
      {!running ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="nl-muted font-mono" style={{ fontSize: 13 }}>
            Duration
            <select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="nl-btn"
              style={{ marginLeft: 10 }}
              aria-label="session duration"
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </label>
          <button className="nl-btn nl-btn-primary" onClick={start}>Begin session</button>
          {!audio.supported && (
            <p className="nl-whisper" style={{ margin: 0 }}>Chimes unavailable — no audio output in this browser.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="nl-whisper" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            {PHASE_LABEL[phase]}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, color: 'var(--ink-primary)' }}>
            {fmt(remaining)}
          </div>
          <div style={{ width: '100%', height: 8, background: 'var(--bg-void)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent-gold)', transition: 'width 900ms linear' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="nl-btn" onClick={() => setPaused((p) => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="nl-btn nl-btn-danger" onClick={end}>End</button>
          </div>
        </div>
      )}
    </Card>
  )
}
