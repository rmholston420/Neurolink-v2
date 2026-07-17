import React from 'react'
import { render, screen } from '@testing-library/react'
import { SSpaceDisplay } from '../components/practice/SSpaceDisplay'

describe('SSpaceDisplay', () => {
  it('renders the plane, region/stage pill, and gate hint', () => {
    render(<SSpaceDisplay alpha={0.6} theta={0.5} region="F" stage="Albedo" />)
    expect(screen.getByLabelText('s-space plane')).toBeInTheDocument()
    expect(screen.getByText(/F · Albedo/)).toBeInTheDocument()
    expect(screen.getByText(/opens the EA-1 gate/i)).toBeInTheDocument()
  })
})
