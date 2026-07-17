import React from 'react'
import { render, screen } from '@testing-library/react'
import { MeditationPanel } from '../components/MeditationPanel.jsx'
import {
  alchemicalStage,
  engagementIndex,
  integrationCoverage,
  sSpaceRegion,
} from '../components/sSpace.js'

describe('sSpace classifier (client mirror of backend)', () => {
  it('defaults to region A on low bands', () => {
    expect(sSpaceRegion(0, 0)).toBe('A')
    expect(alchemicalStage('A')).toBe('Nigredo')
  })

  it('maps high alpha/theta to region H', () => {
    expect(sSpaceRegion(1.5, 1.5)).toBe('H')
    expect(alchemicalStage('H')).toBe('Conjunctio')
  })

  it('engagement index is bounded 0..1', () => {
    expect(engagementIndex(0, 0, 1)).toBe(0)
    expect(engagementIndex(1, 1, 10)).toBe(1)
  })

  it('integration coverage grows with region', () => {
    expect(integrationCoverage('H', 0, null)).toBeGreaterThan(
      integrationCoverage('A', 0, null),
    )
  })
})

describe('MeditationPanel', () => {
  it('renders derived region and stage from bands', () => {
    render(<MeditationPanel bands={{ alpha: 1.5, theta: 1.5, beta: 0.3 }} faa={0.2} />)
    expect(screen.getByText('Meditation State')).toBeInTheDocument()
    expect(screen.getByText('H')).toBeInTheDocument()
    expect(screen.getByText('Conjunctio')).toBeInTheDocument()
    expect(screen.getByText('X7')).toBeInTheDocument()
  })

  it('renders safely with empty bands', () => {
    render(<MeditationPanel bands={{}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Nigredo')).toBeInTheDocument()
  })
})
