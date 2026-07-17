import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FitCheckOverlay, FitCheckBanner } from '../components/signal/FitCheckOverlay'

describe('FitCheckOverlay', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<FitCheckOverlay active={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the fit-check guidance when active', () => {
    render(<FitCheckOverlay active={true} />)
    expect(screen.getByRole('dialog', { name: 'Adjust headset fit' })).toBeInTheDocument()
    expect(screen.getByText('Adjust headset fit')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Electrode positions/ })).toBeInTheDocument()
  })
})

describe('FitCheckBanner', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<FitCheckBanner active={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the banner and fires navigation when active', () => {
    const onGoToSignal = vi.fn()
    render(<FitCheckBanner active={true} onGoToSignal={onGoToSignal} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    screen.getByRole('button', { name: /Go to Signal/ }).click()
    expect(onGoToSignal).toHaveBeenCalledTimes(1)
  })
})
