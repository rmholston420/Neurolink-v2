import React from 'react'

export type TabKey = 'practice' | 'signal' | 'journal'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'practice', label: 'Practice' },
  { key: 'signal', label: 'Signal' },
  { key: 'journal', label: 'Journal' },
]

export function TopNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <nav className="nl-nav" role="tablist" aria-label="Primary sections">
      <h1 className="nl-brand"><span className="om" aria-hidden>ॐ</span>Neurolink-v2</h1>
      <div className="nl-nav-links">
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
      <span className="nl-nav-spacer" />
    </nav>
  )
}
