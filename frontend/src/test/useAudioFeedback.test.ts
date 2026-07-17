import { act, renderHook } from '@testing-library/react'
import { useAudioFeedback } from '../hooks/useAudioFeedback'

// jsdom has no AudioContext, so the engine no-ops; we assert the state machine
// and that synthesis calls never throw.
describe('useAudioFeedback', () => {
  it('starts silent, unmuted, half volume', () => {
    const { result } = renderHook(() => useAudioFeedback())
    expect(result.current.muted).toBe(false)
    expect(result.current.volume).toBe(0.5)
    expect(result.current.soundscape).toBe('silence')
    expect(result.current.supported).toBe(false)
  })

  it('clamps volume to [0,1]', () => {
    const { result } = renderHook(() => useAudioFeedback())
    act(() => result.current.setVolume(5))
    expect(result.current.volume).toBe(1)
    act(() => result.current.setVolume(-2))
    expect(result.current.volume).toBe(0)
  })

  it('toggles mute and switches soundscape', () => {
    const { result } = renderHook(() => useAudioFeedback())
    act(() => result.current.toggleMute())
    expect(result.current.muted).toBe(true)
    act(() => result.current.setSoundscape('alpha-binaural'))
    expect(result.current.soundscape).toBe('alpha-binaural')
  })

  it('playChime does not throw without an AudioContext', () => {
    const { result } = renderHook(() => useAudioFeedback())
    expect(() => act(() => result.current.playChime())).not.toThrow()
  })
})
