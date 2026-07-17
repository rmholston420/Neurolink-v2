import React from 'react'
import { render, screen } from '@testing-library/react'
import { WanderingLog } from '../components/practice/WanderingLog'

describe('WanderingLog', () => {
  it('renders a steady empty state', () => {
    render(<WanderingLog vector={[0.2, 0.2, 0.1, 0.2, 0.05, 0.3]} />)
    expect(screen.getByText('Wandering log')).toBeInTheDocument()
    expect(screen.getByText(/Steady so far/i)).toBeInTheDocument()
  })
})
