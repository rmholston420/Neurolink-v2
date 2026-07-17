import React from 'react'
import type { SignalMode } from '../../lib/wire'
import { SignalModeToggle } from './SignalModeToggle'

export type TabKey = 'practice' | 'signal' | 'journal'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'practice', label: 'Practice' },
  { key: 'signal', label: 'Signal' },
  { key: 'journal', label: 'Journal' },
]

export function TopNav({
  active,
  onChange,
  signalMode,
  onSignalModeChange,
}: {
  active: TabKey
  onChange: (k: TabKey) => void
  signalMode: SignalMode
  onSignalModeChange: (m: SignalMode) => void
}) {
  return (
    <nav className="nl-nav" role="navigation" aria-label="Primary sections">
      <h1 className="nl-brand"><span className="om" aria-hidden>ॐ</span>Neurolink-v2</h1>
      <div className="nl-nav-links" role="tablist" aria-label="Pages">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className="nl-tab"
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <SignalModeToggle mode={signalMode} onChange={onSignalModeChange} />
      <span className="nl-nav-spacer" />
    </nav>
  )
}
