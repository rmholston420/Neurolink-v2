import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MeditationTimer, timerPhase } from '../components/practice/MeditationTimer'

describe('timerPhase', () => {
  it('walks settling → main → dedication → complete', () => {
    const total = 1200 // 20 min
    expect(timerPhase(0, total)).toBe('settling')
    expect(timerPhase(300, total)).toBe('main')
    expect(timerPhase(1180, total)).toBe('dedication')
    expect(timerPhase(1200, total)).toBe('complete')
  })
})

describe('MeditationTimer', () => {
  it('offers a duration control before starting', () => {
    render(<MeditationTimer />)
    expect(screen.getByLabelText('session duration')).toBeInTheDocument()
    expect(screen.getByText('Begin session')).toBeInTheDocument()
  })

  it('shows running controls after begin', () => {
    render(<MeditationTimer />)
    fireEvent.click(screen.getByText('Begin session'))
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText('End')).toBeInTheDocument()
  })
})
