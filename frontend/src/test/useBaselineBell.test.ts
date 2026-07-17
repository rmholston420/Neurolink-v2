import { act, renderHook } from '@testing-library/react'
import { useBaselineBell } from '../hooks/useBaselineBell'

describe('useBaselineBell', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('rings on the configured interval while enabled', () => {
    const onRing = vi.fn()
    renderHook(() => useBaselineBell({ enabled: true, intervalMs: 1000, onRing }))
    act(() => vi.advanceTimersByTime(3500))
    expect(onRing).toHaveBeenCalledTimes(3)
  })

  it('does not ring when disabled', () => {
    const onRing = vi.fn()
    renderHook(() => useBaselineBell({ enabled: false, intervalMs: 1000, onRing }))
    act(() => vi.advanceTimersByTime(5000))
    expect(onRing).not.toHaveBeenCalled()
  })

  it('ringNow fires immediately and records lastRing', () => {
    const onRing = vi.fn()
    const { result } = renderHook(() => useBaselineBell({ enabled: false, intervalMs: 1000, onRing }))
    act(() => result.current.ringNow())
    expect(onRing).toHaveBeenCalledTimes(1)
    expect(result.current.lastRing).not.toBeNull()
  })
})
