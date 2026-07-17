import React, { useRef } from 'react'
import type { SignalMode } from '../../lib/wire'

// Three-pill segmented control (Meditation / Notch / Raw) that lives in the top
// nav, right of the Journal tab. Selecting a mode drives the DSP pipeline
// branch on the backend (POST /api/stream/mode) and the raw/notch page
// behaviours on the frontend. Keyboard: left/right arrows move + activate the
// selection; the group is a WAI-ARIA radiogroup.

const MODES: Array<{ key: SignalMode; label: string; hint: string }> = [
  { key: 'meditation', label: 'Meditation', hint: 'Full DSP pipeline — meditation features active' },
  { key: 'notch', label: 'Notch', hint: 'Mains-hum notch only — fit-checking' },
  { key: 'raw', label: 'Raw', hint: 'Fully raw microvolts — DSP debug' },
]

export function SignalModeToggle({
  mode,
  onChange,
}: {
  mode: SignalMode
  onChange: (mode: SignalMode) => void
}) {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([])

  const move = (delta: number) => {
    const idx = MODES.findIndex((m) => m.key === mode)
    const next = (idx + delta + MODES.length) % MODES.length
    onChange(MODES[next].key)
    btnRefs.current[next]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    }
  }

  return (
    <div
      className="nl-segmented"
      role="radiogroup"
      aria-label="Signal mode"
      onKeyDown={onKeyDown}
    >
      {MODES.map((m, i) => {
        const selected = m.key === mode
        return (
          <button
            key={m.key}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${m.label} signal mode`}
            title={m.hint}
            tabIndex={selected ? 0 : -1}
            className={`nl-segment${selected ? ' nl-segment-active' : ''}`}
            onClick={() => onChange(m.key)}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
