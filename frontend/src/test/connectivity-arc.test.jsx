import React from 'react'
import { render, screen } from '@testing-library/react'
import { ConnectivityArc } from '../components/signal/ConnectivityArc'

describe('ConnectivityArc', () => {
  it('prompts when fewer than two channels are present', () => {
    render(<ConnectivityArc signals={{ TP9: [1, 2, 3] }} />)
    expect(screen.getByText('Connectivity')).toBeInTheDocument()
    expect(screen.getByText(/at least two channels/i)).toBeInTheDocument()
  })

  it('renders arcs and a correlation readout for correlated channels', () => {
    const a = Array.from({ length: 16 }, (_, i) => Math.sin(i))
    const b = a.map((v) => v * 2)
    render(<ConnectivityArc signals={{ TP9: a, AF7: b }} />)
    expect(screen.getByLabelText('Connectivity arcs')).toBeInTheDocument()
    expect(screen.getByText('TP9↔AF7')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
