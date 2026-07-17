import React from 'react'
import { render, screen } from '@testing-library/react'
import { BandPowerChart } from '../components/signal/BandPowerChart'

describe('BandPowerChart', () => {
  it('prompts to start the stream with no channels', () => {
    render(<BandPowerChart channelBands={{}} />)
    expect(screen.getByText(/No live signal yet/i)).toBeInTheDocument()
  })

  it('renders a column per channel with band rows', () => {
    render(<BandPowerChart channelBands={{ TP9: { alpha: 0.5, beta: 0.2 }, AF7: { alpha: 0.1 } }} />)
    expect(screen.getByText('TP9')).toBeInTheDocument()
    expect(screen.getByText('AF7')).toBeInTheDocument()
    // "50.0%" appears for TP9 alpha
    expect(screen.getAllByText(/%$/).length).toBeGreaterThan(0)
  })
})
