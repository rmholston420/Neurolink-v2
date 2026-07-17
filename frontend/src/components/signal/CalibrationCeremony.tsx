import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Card, StatusPill } from '../ui/Card'
import { meditationApi, type Stage0Readiness } from '../../lib/apiClient'
import { TONE_GOOD, TONE_WARN, TONE_BAD, TONE_PEAK } from '../../lib/vajra'
import type { NeurolinkStore } from '../../hooks/useNeurolinkStore'

// CalibrationCeremony — the full 90-second resting-baseline capture (30 s
// warm-up + 60 s baseline) with a Stage-0 pre-flight guard, a guided countdown
// ring, and a post-flight POST /api/meditation/calibration/save. Band means are
// averaged only over the baseline window from real live frames; if no frames
// arrive during that window we refuse to save a fabricated baseline and surface
// an insufficient-data error instead.

const WARMUP_S = 30
const BASELINE_S = 60

type Phase = 'preflight' | 'warmup' | 'baseline' | 'saving' | 'done' | 'error'

interface Props {
  store: NeurolinkStore
  onClose: () => void
}

interface Accum {
  alpha: number
  theta: number
  beta: number
  delta: number
  gamma: number
  faa: number
  faaN: number
  n: number
}

const EMPTY_ACCUM: Accum = { alpha: 0, theta: 0, beta: 0, delta: 0, gamma: 0, faa: 0, faaN: 0, n: 0 }

function Ring({ fraction, label, sub }: { fraction: number; label: string; sub: string }) {
  const r = 54
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(1, fraction)))
  return (
    <svg viewBox="0 0 130 130" style={{ width: 160, height: 160 }} role="img" aria-label={label}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--stroke-veil)" strokeWidth="8" />
      <circle
        cx="65" cy="65" r={r} fill="none" stroke={TONE_PEAK} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 200ms linear' }}
      />
      <text x="65" y="60" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink-primary)" className="font-mono">{label}</text>
      <text x="65" y="82" textAnchor="middle" fontSize="11" fill="var(--ink-muted)">{sub}</text>
    </svg>
  )
}

export function CalibrationCeremony({ store, onClose }: Props) {
  const [readiness, setReadiness] = useState<Stage0Readiness | null>(null)
  const [phase, setPhase] = useState<Phase>('preflight')
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)

  const phaseRef = useRef<Phase>('preflight')
  const accumRef = useRef<Accum>({ ...EMPTY_ACCUM })
  const deadlineRef = useRef<number>(0)

  phaseRef.current = phase

  const loadReadiness = useCallback(async () => {
    try {
      setReadiness(await meditationApi.stage0Readiness())
    } catch {
      setReadiness(null)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'preflight') return
    loadReadiness()
    const t = setInterval(loadReadiness, 2000)
    return () => clearInterval(t)
  }, [phase, loadReadiness])

  // Accumulate live band means only while the baseline window is open.
  useEffect(() => {
    if (phaseRef.current !== 'baseline') return
    const b = store.meditation.bands
    const a = accumRef.current
    a.alpha += b.alpha; a.theta += b.theta; a.beta += b.beta
    a.delta += b.delta; a.gamma += b.gamma; a.n += 1
    if (store.meditation.faa != null) { a.faa += store.meditation.faa; a.faaN += 1 }
  }, [store.frames.eeg, store.meditation])

  const finish = useCallback(async () => {
    const a = accumRef.current
    if (a.n === 0) {
      setPhase('error')
      setError('No live frames during the baseline window — nothing to save.')
      return
    }
    setPhase('saving')
    try {
      const r = await meditationApi.saveCalibration({
        label: 'Baseline',
        alpha_base: a.alpha / a.n,
        theta_base: a.theta / a.n,
        beta_base: a.beta / a.n,
        delta_base: a.delta / a.n,
        gamma_base: a.gamma / a.n,
        faa_base: a.faaN > 0 ? a.faa / a.faaN : 0,
      })
      setSavedId(r.id)
      setPhase('done')
    } catch {
      setPhase('error')
      setError('Could not save the baseline — is the backend reachable?')
    }
  }, [])

  // Single ticking timer driving both timed phases off a wall-clock deadline.
  useEffect(() => {
    if (phase !== 'warmup' && phase !== 'baseline') return
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        if (phaseRef.current === 'warmup') {
          accumRef.current = { ...EMPTY_ACCUM }
          deadlineRef.current = Date.now() + BASELINE_S * 1000
          setPhase('baseline')
          setRemaining(BASELINE_S)
        } else {
          void finish()
        }
      }
    }
    const t = setInterval(tick, 200)
    return () => clearInterval(t)
  }, [phase, finish])

  const begin = useCallback(() => {
    accumRef.current = { ...EMPTY_ACCUM }
    deadlineRef.current = Date.now() + WARMUP_S * 1000
    setRemaining(WARMUP_S)
    setError(null)
    setPhase('warmup')
  }, [])

  const acked = readiness?.acquisition_ready ?? false
  const imp = readiness?.impedance
  const env = readiness?.environment

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calibration ceremony"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(6,6,12,0.82)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div style={{ maxWidth: 560, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <Card
          title="Calibration"
          subtitle="90-second resting baseline · 30 s settle + 60 s capture"
          actions={<button type="button" className="nl-btn" onClick={onClose}>close</button>}
        >
          {phase === 'preflight' && (
            <div className="nl-stack" style={{ gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Acquisition readiness</span>
                <StatusPill tone={acked ? 'good' : 'warn'}>{acked ? 'ready' : 'not ready'}</StatusPill>
              </div>
              {imp ? (
                <div className="nl-whisper" style={{ color: imp.all_channels_ok ? TONE_GOOD : TONE_WARN }}>
                  Impedance: {imp.all_channels_ok ? 'all channels within tolerance' : `check ${imp.bad_channels.join(', ') || 'electrodes'}`}
                </div>
              ) : (
                <div className="nl-whisper" style={{ color: TONE_WARN }}>Readiness unavailable — proceed with caution.</div>
              )}
              {env?.prompts?.length ? (
                <div className="nl-stack" style={{ gap: 6 }}>
                  {env.prompts.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span className="nl-whisper" style={{ color: p.acked ? TONE_GOOD : 'var(--ink-muted)' }}>
                        {p.icon} {p.title}
                      </span>
                      {!p.acked && (
                        <button
                          type="button" className="nl-btn"
                          style={{ fontSize: 12 }}
                          onClick={async () => { await meditationApi.ackStage0({ step_id: p.id }); loadReadiness() }}
                        >
                          acknowledge
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              <button type="button" className="nl-btn nl-btn-primary" onClick={begin} style={{ marginTop: 4 }}>
                Begin calibration
              </button>
              {!acked && (
                <span className="nl-whisper" style={{ color: TONE_WARN }}>
                  Not all pre-flight checks pass — you can still begin, but the baseline may be noisy.
                </span>
              )}
            </div>
          )}

          {(phase === 'warmup' || phase === 'baseline') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <Ring
                fraction={1 - remaining / (phase === 'warmup' ? WARMUP_S : BASELINE_S)}
                label={`${remaining}s`}
                sub={phase === 'warmup' ? 'settle' : 'capturing'}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: phase === 'baseline' ? TONE_PEAK : 'var(--ink-primary)' }}>
                  {phase === 'warmup' ? 'Settle in — breathe naturally' : 'Hold still — capturing baseline'}
                </div>
                <div className="nl-whisper">
                  {phase === 'baseline' ? `${accumRef.current.n} frames captured` : 'baseline capture begins after settle'}
                </div>
              </div>
            </div>
          )}

          {phase === 'saving' && <p className="nl-muted" style={{ marginBottom: 0 }}>Saving baseline…</p>}

          {phase === 'done' && (
            <div className="nl-stack" style={{ gap: 10 }}>
              <StatusPill tone="good">Baseline saved{savedId != null ? ` · #${savedId}` : ''}</StatusPill>
              <p className="nl-muted" style={{ margin: 0 }}>
                Your resting baseline is stored. The Personal Baseline panel now compares live activity against it.
              </p>
              <button type="button" className="nl-btn nl-btn-primary" onClick={onClose}>Done</button>
            </div>
          )}

          {phase === 'error' && (
            <div className="nl-stack" style={{ gap: 10 }}>
              <span style={{ color: TONE_BAD }}>{error}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="nl-btn nl-btn-primary" onClick={() => setPhase('preflight')}>Retry</button>
                <button type="button" className="nl-btn" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
