import React from 'react'
import { render, screen } from '@testing-library/react'
import { DeviceStatusBar } from '../components/signal/DeviceStatusBar'

describe('DeviceStatusBar', () => {
  it('shows placeholders when nothing is connected', () => {
    render(<DeviceStatusBar battery={null} contactMean={null} source={null} connected={false} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('renders battery, signal, and source when connected', () => {
    render(<DeviceStatusBar battery={88} contactMean={0.9} source="Athena" connected={true} />)
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Athena')).toBeInTheDocument()
  })
})
