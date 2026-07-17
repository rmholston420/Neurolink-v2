import { act, renderHook, waitFor } from '@testing-library/react'
import { useSessionGoals } from '../hooks/useSessionGoals'

describe('useSessionGoals', () => {
  it('loads (empty) goals on mount', async () => {
    const { result } = renderHook(() => useSessionGoals())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.goals).toEqual([])
  })

  it('ignores an empty-text goal', async () => {
    const { result } = renderHook(() => useSessionGoals())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    await act(async () => { await result.current.addGoal('   ') })
    expect(result.current.goals).toEqual([])
  })
})
