// Live band powers vs the operator's calibrated resting baseline, read once from
// GET /api/meditation/calibration/latest. Returns null baseline until a
// calibration exists so the UI can render an honest "no baseline yet" state.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { meditationApi } from '../lib/apiClient'
import type { BandName } from '../lib/vajra'

export interface BaselineBands {
  delta: number
  theta: number
  alpha: number
  beta: number
  gamma: number
}

export interface PersonalBaselineState {
  baseline: BaselineBands | null
  label: string | null
  createdAt: string | null
  /** live − baseline per band; null until a baseline is loaded. */
  deltas: BaselineBands | null
  loaded: boolean
  refresh: () => Promise<void>
}

const BASE_KEY: Record<BandName, string> = {
  delta: 'delta_base',
  theta: 'theta_base',
  alpha: 'alpha_base',
  beta: 'beta_base',
  gamma: 'gamma_base',
}

const BANDS: BandName[] = ['delta', 'theta', 'alpha', 'beta', 'gamma']

export function parseBaseline(raw: Record<string, unknown> | null): BaselineBands | null {
  if (!raw || !Object.keys(raw).length) return null
  const has = BANDS.some((b) => raw[BASE_KEY[b]] != null)
  if (!has) return null
  return {
    delta: Number(raw[BASE_KEY.delta]) || 0,
    theta: Number(raw[BASE_KEY.theta]) || 0,
    alpha: Number(raw[BASE_KEY.alpha]) || 0,
    beta: Number(raw[BASE_KEY.beta]) || 0,
    gamma: Number(raw[BASE_KEY.gamma]) || 0,
  }
}

export function usePersonalBaseline(liveBands: Record<BandName, number>): PersonalBaselineState {
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await meditationApi.latestCalibration()
      setRaw(r && Object.keys(r).length ? r : null)
    } catch {
      setRaw(null)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const baseline = useMemo(() => parseBaseline(raw), [raw])
  const label = raw && typeof raw.label === 'string' ? raw.label : null
  const createdAt = raw && typeof raw.created_at === 'string' ? raw.created_at : null

  const deltas = useMemo<BaselineBands | null>(() => {
    if (!baseline) return null
    return {
      delta: (Number(liveBands.delta) || 0) - baseline.delta,
      theta: (Number(liveBands.theta) || 0) - baseline.theta,
      alpha: (Number(liveBands.alpha) || 0) - baseline.alpha,
      beta: (Number(liveBands.beta) || 0) - baseline.beta,
      gamma: (Number(liveBands.gamma) || 0) - baseline.gamma,
    }
  }, [baseline, liveBands])

  return { baseline, label, createdAt, deltas, loaded, refresh }
}
