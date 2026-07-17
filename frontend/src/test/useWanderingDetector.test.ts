import { act, renderHook } from '@testing-library/react'
import { useWanderingDetector, vectorDistance } from '../hooks/useWanderingDetector'

describe('vectorDistance', () => {
  it('is zero for identical vectors', () => {
    expect(vectorDistance([1, 2, 3], [1, 2, 3])).toBe(0)
  })
  it('is the euclidean norm of the difference', () => {
    expect(vectorDistance([0, 0], [3, 4])).toBe(5)
  })
})

describe('useWanderingDetector', () => {
  it('emits an event on a large jump but not on small drift', () => {
    let vec: number[] = [0, 0]
    const { result, rerender } = renderHook(() => useWanderingDetector(vec, { cooldownMs: 0, threshold: 0.25 }))
    // small drift — no event
    act(() => { vec = [0.01, 0.01]; rerender() })
    expect(result.current.events).toHaveLength(0)
    // big jump — one event
    act(() => { vec = [0.5, 0.5]; rerender() })
    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0].intensity).toBeGreaterThan(0)
  })

  it('tags and clears events', () => {
    let vec: number[] = [0, 0]
    const { result, rerender } = renderHook(() => useWanderingDetector(vec, { cooldownMs: 0 }))
    act(() => { vec = [1, 1]; rerender() })
    const id = result.current.events[0].id
    act(() => result.current.tag(id, 'planning'))
    expect(result.current.events[0].tag).toBe('planning')
    act(() => result.current.clear())
    expect(result.current.events).toHaveLength(0)
  })
})
