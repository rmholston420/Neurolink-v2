import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { PersonalBaseline } from '../components/practice/PersonalBaseline'

const LIVE = { delta: 0.2, theta: 0.2, alpha: 0.3, beta: 0.1, gamma: 0.05 }

describe('PersonalBaseline', () => {
  it('shows a no-baseline prompt when none is stored', async () => {
    render(<PersonalBaseline liveBands={LIVE} />)
    expect(screen.getByText('Personal baseline')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/No baseline captured yet/i)).toBeInTheDocument())
  })
})
