// Client-side HRV coherence from the live IBI stream. "Coherence" here follows
// the HeartMath sense: how concentrated the heart-rate oscillation is around a
// single dominant rhythm (high when breathing paces the heart smoothly). We run
// a small DFT over the IBI tachogram and take the dominant-peak concentration.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CoherenceSample } from '../lib/types'

const MIN_IBIS = 8
const MAX_SAMPLES = 240 // rolling coherence history cap

// Pure, testable: dominant-peak concentration of the detrended IBI series.
// Returns 0..1. Too-short or flat input -> 0.
export function computeCoherence(ibiMs: number[]): number {
  const n = ibiMs.length
  if (n < MIN_IBIS) return 0
  const mean = ibiMs.reduce((a, b) => a + b, 0) / n
  const x = ibiMs.map((v) => v - mean)
  const variance = x.reduce((a, b) => a + b * b, 0) / n
  if (variance < 1e-9) return 0

  // Naive DFT power over bins 1..n/2 (O(n^2); n<=60 in practice).
  const half = Math.floor(n / 2)
  const power: number[] = []
  for (let k = 1; k <= half; k++) {
    let re = 0
    let im = 0
    for (let t = 0; t < n; t++) {
      const ang = (-2 * Math.PI * k * t) / n
      re += x[t] * Math.cos(ang)
      im += x[t] * Math.sin(ang)
    }
    power.push(re * re + im * im)
  }
  const total = power.reduce((a, b) => a + b, 0)
  if (total < 1e-9) return 0

  // Peak + immediate neighbours vs total = concentration around one rhythm.
  let peakIdx = 0
  for (let i = 1; i < power.length; i++) if (power[i] > power[peakIdx]) peakIdx = i
  const band =
    power[peakIdx] +
    (power[peakIdx - 1] ?? 0) +
    (power[peakIdx + 1] ?? 0)
  return Math.max(0, Math.min(1, band / total))
}

export interface HRVCoherenceState {
  coherence: number
  history: CoherenceSample[]
  /** Session score = mean coherence over the session, 0..1. */
  score: number
  hr: number | null
}

export function useHRVCoherence(ibiMs: number[] | null | undefined): HRVCoherenceState {
  const [history, setHistory] = useState<CoherenceSample[]>([])
  const lastKey = useRef<string>('')

  const coherence = useMemo(() => computeCoherence(ibiMs ?? []), [ibiMs])
  const hr = useMemo(() => {
    if (!ibiMs || !ibiMs.length) return null
    const last = ibiMs[ibiMs.length - 1]
    return last > 0 ? Math.round(60000 / last) : null
  }, [ibiMs])

  useEffect(() => {
    if (!ibiMs || ibiMs.length < MIN_IBIS) return
    // De-dupe on identical IBI windows so re-renders don't inflate history.
    const key = `${ibiMs.length}:${ibiMs[ibiMs.length - 1]}`
    if (key === lastKey.current) return
    lastKey.current = key
    setHistory((prev) =>
      [...prev, { t: Date.now(), coherence, hr: hr ?? 0 }].slice(-MAX_SAMPLES),
    )
  }, [ibiMs, coherence, hr])

  const score = useMemo(() => {
    if (!history.length) return 0
    return history.reduce((a, s) => a + s.coherence, 0) / history.length
  }, [history])

  return { coherence, history, score, hr }
}
