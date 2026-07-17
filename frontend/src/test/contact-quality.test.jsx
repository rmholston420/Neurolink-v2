import React from 'react'
import { render, screen } from '@testing-library/react'
import { ContactQuality } from '../components/signal/ContactQuality'

describe('ContactQuality', () => {
  it('falls back to the frontal-4 with no contact map', () => {
    render(<ContactQuality contact={{}} channelNames={[]} />)
    expect(screen.getByText('Contact quality')).toBeInTheDocument()
    expect(screen.getByText('TP9')).toBeInTheDocument()
    expect(screen.getByText('TP10')).toBeInTheDocument()
  })

  it('labels a healthy electrode as good', () => {
    render(<ContactQuality contact={{ TP9: 0.9 }} channelNames={['TP9']} />)
    expect(screen.getByText(/good · 90%/)).toBeInTheDocument()
  })
})
