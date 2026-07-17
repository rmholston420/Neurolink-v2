import { renderHook } from '@testing-library/react'
import { computeCoherence, useHRVCoherence } from '../hooks/useHRVCoherence'

describe('computeCoherence', () => {
  it('returns 0 for too-short input', () => {
    expect(computeCoherence([800, 810, 790])).toBe(0)
  })

  it('returns 0 for a flat (zero-variance) series', () => {
    expect(computeCoherence(new Array(16).fill(900))).toBe(0)
  })

  it('is high for a clean single-rhythm oscillation', () => {
    const n = 32
    const ibi = Array.from({ length: n }, (_, t) => 900 + 40 * Math.sin((2 * Math.PI * 3 * t) / n))
    const c = computeCoherence(ibi)
    expect(c).toBeGreaterThan(0.5)
    expect(c).toBeLessThanOrEqual(1)
  })

  it('is lower for broadband noise than for a pure rhythm', () => {
    const n = 32
    const pure = Array.from({ length: n }, (_, t) => 900 + 40 * Math.sin((2 * Math.PI * 3 * t) / n))
    const noisy = Array.from({ length: n }, (_, t) => 900 + ((t * 37) % 11) - 5)
    expect(computeCoherence(pure)).toBeGreaterThan(computeCoherence(noisy))
  })
})

describe('useHRVCoherence', () => {
  it('reports null hr and 0 score with no data', () => {
    const { result } = renderHook(() => useHRVCoherence(null))
    expect(result.current.hr).toBeNull()
    expect(result.current.score).toBe(0)
    expect(result.current.history).toEqual([])
  })

  it('derives instantaneous hr from the last IBI', () => {
    const { result } = renderHook(() => useHRVCoherence([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]))
    expect(result.current.hr).toBe(60)
  })
})
