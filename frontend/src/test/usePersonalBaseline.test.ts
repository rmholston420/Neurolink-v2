import { renderHook, waitFor } from '@testing-library/react'
import { parseBaseline, usePersonalBaseline } from '../hooks/usePersonalBaseline'

describe('parseBaseline', () => {
  it('returns null for empty or non-baseline records', () => {
    expect(parseBaseline(null)).toBeNull()
    expect(parseBaseline({})).toBeNull()
    expect(parseBaseline({ label: 'x' })).toBeNull()
  })

  it('maps *_base keys to a band vector', () => {
    const b = parseBaseline({ alpha_base: 0.3, theta_base: 0.2, beta_base: 0.1, delta_base: 0.25, gamma_base: 0.05 })
    expect(b).toEqual({ alpha: 0.3, theta: 0.2, beta: 0.1, delta: 0.25, gamma: 0.05 })
  })
})

describe('usePersonalBaseline', () => {
  it('marks loaded with null baseline when none is stored', async () => {
    const live = { delta: 0.2, theta: 0.2, alpha: 0.2, beta: 0.2, gamma: 0.2 }
    const { result } = renderHook(() => usePersonalBaseline(live))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.baseline).toBeNull()
    expect(result.current.deltas).toBeNull()
  })
})
