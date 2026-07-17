import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { AlchemicalJournal } from '../components/practice/AlchemicalJournal'

describe('AlchemicalJournal', () => {
  it('renders the stage path and an empty note state', async () => {
    render(<AlchemicalJournal stage="Albedo" region="C" />)
    expect(screen.getByText('Nigredo')).toBeInTheDocument()
    expect(screen.getByText('Conjunctio')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/No notes yet/i)).toBeInTheDocument())
  })

  it('exposes a note composer', () => {
    render(<AlchemicalJournal stage="Nigredo" region="A" />)
    expect(screen.getByLabelText('journal note')).toBeInTheDocument()
  })
})
