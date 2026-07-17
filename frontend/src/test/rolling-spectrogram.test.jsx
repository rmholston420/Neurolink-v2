import React from 'react'
import { render, screen } from '@testing-library/react'
import { RollingSpectrogram } from '../components/signal/RollingSpectrogram'

describe('RollingSpectrogram', () => {
  it('shows a no-data notice when no signals present', () => {
    render(<RollingSpectrogram signals={{}} />)
    expect(screen.getByText('Rolling spectrogram')).toBeInTheDocument()
    expect(screen.getByText(/No raw samples yet/i)).toBeInTheDocument()
  })

  it('renders a channel selector including mean', () => {
    render(<RollingSpectrogram signals={{ TP9: [1, 2, 3], AF7: [3, 2, 1] }} />)
    expect(screen.getByRole('button', { name: 'mean' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'TP9' })).toBeInTheDocument()
  })
})
