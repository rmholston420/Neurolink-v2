import React from 'react'
import { render, screen } from '@testing-library/react'
import { EA1Score } from '../components/practice/EA1Score'
import type { Ea1Result } from '../hooks/useNeurolinkStore'

const RESULT: Ea1Result = {
  eligible: true,
  score: 0.6,
  criteria_met: 3,
  criteria_total: 5,
  label: 'EA1 Eligible',
  gates: { s_space: true, motion: true },
  s_space_region: 'F',
  overlay_mode: 'X5',
  integration_coverage: 0.48,
  criteria: {
    hrv_rmssd: { value: 48.3, threshold: 40, units: 'ms', met: true },
    rr_bpm: { value: 5.6, threshold: null, range: [4, 8], units: 'BPM', met: true },
    faa: { value: 0.18, threshold: 0, units: '', met: true },
    fmt: { value: 0.1, threshold: 0.15, units: '', met: false },
    poincare_ratio: { value: 0.54, threshold: 0.7, units: '', met: false },
  },
}

describe('EA1Score', () => {
  it('prompts when no result is available', () => {
    render(<EA1Score ea1={null} />)
    expect(screen.getByText(/Awaiting live signal/i)).toBeInTheDocument()
  })

  it('renders the label, gates, and criterion rows', () => {
    render(<EA1Score ea1={RESULT} />)
    expect(screen.getByText('EA1 Eligible')).toBeInTheDocument()
    expect(screen.getByText(/s-space F open/i)).toBeInTheDocument()
    expect(screen.getByText('HRV RMSSD')).toBeInTheDocument()
    expect(screen.getByText('Frontal-midline θ')).toBeInTheDocument()
  })
})
