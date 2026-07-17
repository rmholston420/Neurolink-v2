import React from 'react'
import { render, screen } from '@testing-library/react'
import { TopoMap } from '../components/signal/TopoMap'

describe('TopoMap', () => {
  it('shows an empty prompt with no data', () => {
    render(<TopoMap channelBands={{}} />)
    expect(screen.getByText('Topographic map')).toBeInTheDocument()
    expect(screen.getByText(/Start the stream/i)).toBeInTheDocument()
  })

  it('renders band selector buttons', () => {
    render(<TopoMap channelBands={{ TP9: { alpha: 0.4 }, AF7: { alpha: 0.2 } }} />)
    expect(screen.getByRole('button', { name: 'alpha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'gamma' })).toBeInTheDocument()
  })
})
