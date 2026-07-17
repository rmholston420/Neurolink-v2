import React, { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { meditationApi } from '../../lib/apiClient'
import { BAND_ORDER, BAND_VAR, BAND_GLYPH, type BandName } from '../../lib/vajra'

// CalibrationPanel — visualization-only comparison of the stored resting
// baseline against the live mean band powers. Rewired from v1's POST-driven
// calibrate button to v2's read-only GET /meditation/calibration/latest;
// capture flow lives in the meditation calibration controller, not here.

interface Props {
  liveBands: Record<BandName, number>
}

interface Baseline {
  label?: string
  created_at?: string
  alpha_base?: number
  theta_base?: number
  beta_base?: number
  delta_base?: number
  gamma_base?: number
}

const BASE_KEY: Record<BandName, keyof Baseline> = {
  delta: 'delta_base',
  theta: 'theta_base',
  alpha: 'alpha_base',
  beta: 'beta_base',
  gamma: 'gamma_base',
}

export function CalibrationPanel({ liveBands }: Props) {
  const [baseline, setBaseline] = useState<Baseline | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    meditationApi
      .latestCalibration()
      .then((r) => {
        if (!alive) return
        setBaseline(r && Object.keys(r).length ? (r as Baseline) : null)
        setLoaded(true)
      })
      .catch(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  const max = Math.max(
    0.001,
    ...BAND_ORDER.flatMap((b) => [Number(liveBands[b]) || 0, Number(baseline?.[BASE_KEY[b]]) || 0]),
  )

  return (
    <Card title="Calibration" subtitle={baseline?.label ? `Baseline: ${baseline.label}` : 'Resting baseline vs live'}>
      {!loaded ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Loading baseline…</p>
      ) : !baseline ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>No baseline captured yet. Run a calibration in the meditation flow.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BAND_ORDER.map((b) => {
            const live = Number(liveBands[b]) || 0
            const base = Number(baseline[BASE_KEY[b]]) || 0
            return (
              <div key={b}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="font-mono" style={{ fontSize: 12, color: BAND_VAR[b] }}>{BAND_GLYPH[b]} {b}</span>
                  <span className="font-mono nl-whisper">live {live.toFixed(3)} · base {base.toFixed(3)}</span>
                </div>
                <div style={{ position: 'relative', height: 10, background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${(base / max) * 100}%`, background: 'var(--stroke-veil)' }} />
                  <div style={{ position: 'absolute', inset: 0, width: `${(live / max) * 100}%`, background: BAND_VAR[b], opacity: 0.85, transition: 'width 240ms ease' }} />
                </div>
              </div>
            )
          })}
          <div className="nl-whisper">Filled bar = live · grey underlay = baseline</div>
        </div>
      )}
    </Card>
  )
}
