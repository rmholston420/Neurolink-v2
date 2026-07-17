import React from 'react'
import { render, screen } from '@testing-library/react'
import { BandTrend } from '../components/signal/BandTrend'

describe('BandTrend', () => {
  it('prompts when history is too short', () => {
    render(<BandTrend history={[]} />)
    expect(screen.getByText('Band trend')).toBeInTheDocument()
    expect(screen.getByText(/Streaming data will populate/i)).toBeInTheDocument()
  })

  it('renders the trend svg once enough history exists', () => {
    const history = Array.from({ length: 5 }, () => ({ alpha: 0.4, theta: 0.2, beta: 0.1, delta: 0.3, gamma: 0.05 }))
    render(<BandTrend history={history} />)
    expect(screen.getByLabelText('Band power trend')).toBeInTheDocument()
  })
})
