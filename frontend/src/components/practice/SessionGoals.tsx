import React, { useState } from 'react'
import { Card } from '../ui/Card'
import { useSessionGoals } from '../../hooks/useSessionGoals'

// Persisted intention list for the practice. Goals are stored server-side
// (/api/journal/goals); progress is nudged by hand here and mirrors the clamp
// the API enforces.

export function SessionGoals() {
  const { goals, loaded, addGoal, updateGoal, deleteGoal } = useSessionGoals()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await addGoal(draft)
      setDraft('')
    } catch {
      /* keep draft on failure */
    } finally {
      setBusy(false)
    }
  }

  const bump = (id: number, current: number, delta: number) => {
    const next = Math.max(0, Math.min(1, current + delta))
    void updateGoal(id, { progress: next, achieved: next >= 1 })
  }

  return (
    <Card title="Session goals" subtitle="Intentions for the practice">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
          placeholder="Set an intention…"
          aria-label="new goal"
          className="font-mono"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke-veil)', background: 'var(--bg-void)', color: 'var(--ink-primary)' }}
        />
        <button className="nl-btn nl-btn-primary" onClick={() => void submit()} disabled={busy || !draft.trim()}>Add</button>
      </div>

      {!loaded ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Loading goals…</p>
      ) : goals.length === 0 ? (
        <p className="nl-whisper" style={{ marginBottom: 0 }}>No goals yet — set one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map((g) => (
            <li key={g.id} style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-shrine-hi)', border: `1px solid ${g.achieved ? 'var(--accent-gold)' : 'var(--stroke-veil)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--ink-primary)', fontSize: 14, textDecoration: g.achieved ? 'line-through' : 'none' }}>{g.text}</span>
                <button aria-label={`delete goal ${g.id}`} className="nl-btn" onClick={() => void deleteGoal(g.id)}>×</button>
              </div>
              <div style={{ height: 6, background: 'var(--bg-void)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', margin: '8px 0 6px' }}>
                <div style={{ width: `${g.progress * 100}%`, height: '100%', background: 'var(--accent-teal)', transition: 'width 240ms ease' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="nl-btn" onClick={() => bump(g.id, g.progress, -0.25)}>−</button>
                <span className="font-mono nl-whisper" style={{ fontSize: 12 }}>{(g.progress * 100).toFixed(0)}%</span>
                <button className="nl-btn" onClick={() => bump(g.id, g.progress, 0.25)}>+</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
