import React from 'react'
import { render, screen } from '@testing-library/react'
import { HRVCoherenceTrainer } from '../components/practice/HRVCoherenceTrainer'

describe('HRVCoherenceTrainer', () => {
  it('renders an honest empty state without enough beats', () => {
    render(<HRVCoherenceTrainer hrv={null} />)
    expect(screen.getByText('HRV coherence trainer')).toBeInTheDocument()
    expect(screen.getByText(/Gathering heartbeats/i)).toBeInTheDocument()
  })

  it('renders the coherence gauge with a full IBI window', () => {
    const ibi = Array.from({ length: 16 }, (_, t) => 900 + 40 * Math.sin((2 * Math.PI * 3 * t) / 16))
    render(<HRVCoherenceTrainer hrv={{ rmssd: 48, sdnn: 55, hr_bpm: 61, sd1: 34, sd2: 62, ibi_ms: ibi }} />)
    expect(screen.getByLabelText('coherence gauge')).toBeInTheDocument()
    expect(screen.getByText('COHERENCE')).toBeInTheDocument()
  })
})
