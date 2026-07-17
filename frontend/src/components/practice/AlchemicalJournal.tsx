import React, { useState } from 'react'
import { Card } from '../ui/Card'
import { useAlchemicalJournal } from '../../hooks/useAlchemicalJournal'
import { ALCHEMICAL_STAGES } from '../../lib/types'

// The alchemical progression as a lit path (Nigredo → Conjunctio), a transition
// history, and a durable note log (persisted via /api/journal/notes) stamped
// with the stage/region they were written in.

interface Props {
  stage: string | null
  region?: string | null
}

function timeOf(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function AlchemicalJournal({ stage, region }: Props) {
  const { transitions, notes, loaded, addNote } = useAlchemicalJournal(stage, region)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await addNote(draft)
      setDraft('')
    } catch {
      /* backend offline; keep the draft so nothing is lost */
    } finally {
      setSaving(false)
    }
  }

  const activeIdx = ALCHEMICAL_STAGES.findIndex((s) => s === stage)

  return (
    <Card title="Alchemical journal" subtitle="Stages of the work">
      {/* Stage path */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ALCHEMICAL_STAGES.map((s, i) => {
          const reached = activeIdx >= 0 && i <= activeIdx
          const current = i === activeIdx
          return (
            <span
              key={s}
              className="font-mono"
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                border: `1px solid ${current ? 'var(--accent-gold)' : 'var(--stroke-veil)'}`,
                background: reached ? 'var(--bg-shrine-hi)' : 'transparent',
                color: reached ? 'var(--ink-primary)' : 'var(--ink-whisper)',
              }}
            >
              {s}
            </span>
          )
        })}
      </div>

      {/* Transition history */}
      {transitions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="nl-whisper" style={{ marginBottom: 6 }}>Transitions</div>
          <ul className="font-mono" style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {transitions.slice(-6).reverse().map((t) => (
              <li key={`${t.stage}-${t.t}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.stage}</span>
                <span className="nl-whisper">{timeOf(t.t)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Note composer */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
          placeholder="Note this moment…"
          aria-label="journal note"
          className="font-mono"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke-veil)', background: 'var(--bg-void)', color: 'var(--ink-primary)' }}
        />
        <button className="nl-btn nl-btn-primary" onClick={() => void submit()} disabled={saving || !draft.trim()}>
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>

      {/* Notes */}
      {!loaded ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="nl-whisper" style={{ marginBottom: 0 }}>No notes yet — capture an insight above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.slice(0, 8).map((n) => (
            <li key={n.id} style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-shrine-hi)', border: '1px solid var(--stroke-veil)' }}>
              <div style={{ color: 'var(--ink-primary)', fontSize: 14 }}>{n.text}</div>
              <div className="font-mono nl-whisper" style={{ fontSize: 11, marginTop: 4 }}>
                {[n.stage, n.region].filter(Boolean).join(' · ') || 'unstamped'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
