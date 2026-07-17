import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SignalModeToggle } from '../components/shell/SignalModeToggle'

describe('SignalModeToggle', () => {
  it('renders three mode pills and highlights the selected one', () => {
    render(<SignalModeToggle mode="notch" onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Meditation/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /Notch/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Raw/ })).toHaveAttribute('aria-checked', 'false')
    // Selected pill carries the active class.
    expect(screen.getByRole('radio', { name: /Notch/ }).className).toContain('nl-segment-active')
  })

  it('fires onChange with the clicked mode', () => {
    const onChange = vi.fn()
    render(<SignalModeToggle mode="meditation" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Raw/ }))
    expect(onChange).toHaveBeenCalledWith('raw')
  })

  it('moves selection with left/right arrow keys', () => {
    const onChange = vi.fn()
    render(<SignalModeToggle mode="meditation" onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Signal mode' })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('notch')
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    // From meditation (index 0), ArrowLeft wraps to raw.
    expect(onChange).toHaveBeenLastCalledWith('raw')
  })
})
