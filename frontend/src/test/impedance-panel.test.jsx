import React from 'react'
import { render, screen } from '@testing-library/react'
import { ImpedancePanel } from '../components/signal/ImpedancePanel'

describe('ImpedancePanel', () => {
  it('shows an empty prompt with no readings', () => {
    render(<ImpedancePanel impedance={{}} />)
    expect(screen.getByText('Impedance')).toBeInTheDocument()
    expect(screen.getByText(/No impedance estimate yet/i)).toBeInTheDocument()
  })

  it('renders per-channel kΩ values sorted by label', () => {
    render(<ImpedancePanel impedance={{ TP9: 12.3, AF7: 8.1 }} />)
    expect(screen.getByText('12.3')).toBeInTheDocument()
    expect(screen.getByText('8.1')).toBeInTheDocument()
    expect(screen.getByText('AF7')).toBeInTheDocument()
  })
})
