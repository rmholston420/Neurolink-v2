import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CommandBar } from '../components/shell/CommandBar'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'

function makeStore(overrides: Partial<NeurolinkStore> = {}): NeurolinkStore {
  return {
    deviceStatus: { is_streaming: false },
    recording: { recording: false, path: '' },
    streamStatus: 'idle',
    meditation: { bands: {}, faa: 0 },
    startStream: vi.fn(),
    stopStream: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    ...overrides,
  } as unknown as NeurolinkStore
}

const startBtn = () => screen.getByRole('button', { name: 'Start stream' })
const stopBtn = () => screen.getByRole('button', { name: 'Stop stream' })

describe('CommandBar stream buttons', () => {
  it('leaves Start enabled when the backend streams but the user has not requested it (curl/connect side effect)', () => {
    render(<CommandBar store={makeStore({ deviceStatus: { is_streaming: true } as any, streamStatus: 'idle' })} />)
    expect(startBtn()).not.toBeDisabled()
    // Stop is always available whenever the board is streaming.
    expect(stopBtn()).not.toBeDisabled()
  })

  it('disables Start only once the user has started AND the backend confirms streaming', () => {
    render(<CommandBar store={makeStore({ deviceStatus: { is_streaming: true } as any, streamStatus: 'streaming' })} />)
    expect(startBtn()).toBeDisabled()
    expect(stopBtn()).not.toBeDisabled()
  })

  it('enables Start and disables Stop when nothing is streaming', () => {
    render(<CommandBar store={makeStore()} />)
    expect(startBtn()).not.toBeDisabled()
    expect(stopBtn()).toBeDisabled()
  })
})
