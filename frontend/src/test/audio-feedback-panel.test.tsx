import React from 'react'
import { render, screen } from '@testing-library/react'
import { AudioFeedbackPanel } from '../components/practice/AudioFeedbackPanel'
import type { AudioFeedback } from '../hooks/useAudioFeedback'

function makeAudio(overrides: Partial<AudioFeedback> = {}): AudioFeedback {
  return {
    muted: false,
    volume: 0.5,
    soundscape: 'silence',
    supported: true,
    setMuted: () => {},
    toggleMute: () => {},
    setVolume: () => {},
    setSoundscape: () => {},
    playChime: () => {},
    ...overrides,
  }
}

describe('AudioFeedbackPanel', () => {
  it('renders the volume slider, soundscape radiogroup, and mute toggle', () => {
    render(<AudioFeedbackPanel audio={makeAudio()} />)
    expect(screen.getByLabelText('volume')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'soundscape' })).toBeInTheDocument()
    expect(screen.getByText('Alpha binaural')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument()
  })

  it('warns when audio is unsupported', () => {
    render(<AudioFeedbackPanel audio={makeAudio({ supported: false })} />)
    expect(screen.getByText(/Audio output is unavailable/i)).toBeInTheDocument()
  })
})
