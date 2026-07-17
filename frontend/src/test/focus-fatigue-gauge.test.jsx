import React from 'react'
import { render, screen } from '@testing-library/react'
import { FocusFatigueGauge } from '../components/signal/FocusFatigueGauge'

describe('FocusFatigueGauge', () => {
  it('shows an empty prompt with no state data', () => {
    render(<FocusFatigueGauge focusState={null} focusScore={null} fatigue={null} />)
    expect(screen.getByText('Focus & fatigue')).toBeInTheDocument()
    expect(screen.getByText(/No state data yet/i)).toBeInTheDocument()
  })

  it('renders both gauges when state is present', () => {
    render(<FocusFatigueGauge focusState="HIGH" focusScore={0.82} fatigue={0.3} />)
    expect(screen.getByLabelText('focus gauge')).toBeInTheDocument()
    expect(screen.getByLabelText('fatigue gauge')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
  })
})
