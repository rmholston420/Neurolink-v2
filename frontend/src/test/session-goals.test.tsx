import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SessionGoals } from '../components/practice/SessionGoals'

describe('SessionGoals', () => {
  it('renders the composer and an empty state after load', async () => {
    render(<SessionGoals />)
    expect(screen.getByLabelText('new goal')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/No goals yet/i)).toBeInTheDocument())
  })
})
