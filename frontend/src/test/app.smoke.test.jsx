import React from 'react'
import { render, screen } from '@testing-library/react'
import { App } from '../main.jsx'

describe('App smoke test', () => {
  it('renders the main Neurolink heading', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Neurolink-v2/i, level: 1 })).toBeInTheDocument()
  })
})
