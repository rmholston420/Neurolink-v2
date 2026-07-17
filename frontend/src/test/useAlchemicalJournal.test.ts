import { renderHook, waitFor } from '@testing-library/react'
import { useAlchemicalJournal } from '../hooks/useAlchemicalJournal'

describe('useAlchemicalJournal', () => {
  it('records a transition when the stage changes', async () => {
    let stage = 'Nigredo'
    const { result, rerender } = renderHook(() => useAlchemicalJournal(stage))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.transitions.map((t) => t.stage)).toEqual(['Nigredo'])

    stage = 'Albedo'
    rerender()
    expect(result.current.transitions.map((t) => t.stage)).toEqual(['Nigredo', 'Albedo'])

    // no duplicate transition when stage is unchanged
    rerender()
    expect(result.current.transitions).toHaveLength(2)
  })

  it('ignores a null stage', async () => {
    const { result } = renderHook(() => useAlchemicalJournal(null))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.transitions).toHaveLength(0)
  })
})
