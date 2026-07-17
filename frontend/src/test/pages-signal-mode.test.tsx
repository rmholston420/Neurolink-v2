import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PracticePage } from '../pages/PracticePage'
import { SignalPage } from '../pages/SignalPage'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'
import type { SignalMode } from '../lib/wire'

const meditation = {
  bands: { alpha: 0.2, theta: 0.2, beta: 0.2, delta: 0.2, gamma: 0.2 },
  faa: 0, region: 'A', stage: 'Nigredo', overlay: 'X0', engagement: 0, coverage: 0,
}

function makeStore(mode: SignalMode): NeurolinkStore {
  return {
    frames: { eeg: null, optical: null, imu: null },
    wsStatus: 'closed',
    meditation, hrv: null, breathing: null, ea1: null, poorFit: false,
    signalMode: mode,
    // Signal page fields
    flattenedBands: {}, rawEeg: {}, channelNames: [], bandHistory: [],
    streamHealth: null, streamHealthHistory: [], contact: {}, impedance: {},
    focusState: null, focusScore: null, fatigue: null, battery: null,
    deviceStatus: null,
  } as unknown as NeurolinkStore
}

describe('PracticePage signal-mode banner', () => {
  it('hides the raw-mode banner in meditation mode', () => {
    render(<PracticePage store={makeStore('meditation')} />)
    expect(screen.queryByText(/Raw signal mode active/)).not.toBeInTheDocument()
  })

  it('shows the raw-mode banner and dims the panels in raw mode', () => {
    const { container } = render(<PracticePage store={makeStore('raw')} />)
    expect(screen.getByText(/Raw signal mode active/)).toBeInTheDocument()
    const dimmed = container.querySelector('[aria-hidden="true"]') as HTMLElement | null
    expect(dimmed).not.toBeNull()
    expect(dimmed!.style.opacity).toBe('0.4')
    expect(dimmed!.style.pointerEvents).toBe('none')
  })
})

describe('SignalPage raw traces panel', () => {
  it('omits the raw electrode traces panel in meditation mode', () => {
    render(<SignalPage store={makeStore('meditation')} />)
    expect(screen.queryByText('Raw electrode traces')).not.toBeInTheDocument()
  })

  it('renders the raw electrode traces panel in notch mode', () => {
    render(<SignalPage store={makeStore('notch')} />)
    expect(screen.getByText('Raw electrode traces')).toBeInTheDocument()
  })
})
