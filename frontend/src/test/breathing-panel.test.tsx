import React from 'react'
import { render, screen } from '@testing-library/react'
import { BreathingPanel, breathLabel, breathScale } from '../components/practice/BreathingPanel'

describe('breath phase helpers', () => {
  it('labels the four phases across a cycle', () => {
    expect(breathLabel(0.1)).toBe('inhale')
    expect(breathLabel(0.45)).toBe('hold-in')
    expect(breathLabel(0.7)).toBe('exhale')
    expect(breathLabel(0.95)).toBe('hold-out')
  })
  it('scales 0 at exhale-end and 1 at inhale-peak', () => {
    expect(breathScale(0)).toBe(0)
    expect(breathScale(0.4)).toBeCloseTo(1)
    expect(breathScale(0.45)).toBe(1)
  })
})

describe('BreathingPanel', () => {
  it('shows a dash for rate without a breathing block', () => {
    render(<BreathingPanel breathing={null} />)
    expect(screen.getByText('Breath pacer')).toBeInTheDocument()
    expect(screen.getByText(/Awaiting breath signal/i)).toBeInTheDocument()
  })

  it('renders the measured rate when present', () => {
    render(<BreathingPanel breathing={{ rate_bpm: 5.6, rr_ppg: 5.4, rr_accel: 5.8, phase: 0.3, phase_label: 'hold' }} coherence={0.7} />)
    expect(screen.getByText('5.6 bpm')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })
})
