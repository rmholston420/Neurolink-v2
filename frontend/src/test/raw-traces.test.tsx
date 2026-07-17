import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RawTraces } from '../components/signal/RawTraces'

describe('RawTraces', () => {
  it('shows the RAW badge in raw mode', () => {
    render(<RawTraces signals={{}} timestamps={[]} mode="raw" />)
    expect(screen.getByText('Raw electrode traces')).toBeInTheDocument()
    expect(screen.getByText('RAW')).toBeInTheDocument()
  })

  it('shows the NOTCH · mains-Hz badge in notch mode', () => {
    render(<RawTraces signals={{}} timestamps={[]} mode="notch" mainsHz={50} />)
    expect(screen.getByText('NOTCH · 50 Hz')).toBeInTheDocument()
  })

  it('renders a no-data hint when no samples are present', () => {
    render(<RawTraces signals={{}} timestamps={[]} mode="raw" />)
    expect(screen.getByText(/No raw samples yet/)).toBeInTheDocument()
  })

  it('drops the no-data hint once samples arrive', () => {
    render(<RawTraces signals={{ TP9: [1, 2, 3] }} timestamps={[0, 1, 2]} mode="raw" />)
    expect(screen.queryByText(/No raw samples yet/)).not.toBeInTheDocument()
  })
})
