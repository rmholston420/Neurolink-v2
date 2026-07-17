import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, StatusPill } from '../ui/Card'
import { sessionApi, type SessionAggregate } from '../../lib/apiClient'

// SessionHistoryPanel — server-side list of recorded sessions (GET /api/sessions/)
// enriched per-row with the cheap aggregate summary (GET .../summary): duration,
// EA-1-eligible seconds, dominant alchemical stage, and note count. Sortable by
// date / duration / eligibility and filterable by label or stage. Selecting a
// row raises onSelect for the detail view; each row exposes per-session CSV/JSON
// export links.

type SortKey = 'date' | 'duration' | 'eligible'

interface Props {
  selectedId: number | null
  onSelect: (id: number) => void
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function fmtDuration(s: number | null): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export function SessionHistoryPanel({ selectedId, onSelect }: Props) {
  const [rows, setRows] = useState<SessionAggregate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    try {
      const list = await sessionApi.list()
      const summaries = await Promise.all(
        list.map((s) =>
          sessionApi.summary(s.id).catch(
            (): SessionAggregate => ({
              id: s.id, label: s.label, preset: s.preset,
              started_at: s.started_at, ended_at: s.ended_at, duration_s: s.duration_s,
              frame_count: 0, notes_count: 0, wandering_count: 0,
            }),
          ),
        ),
      )
      setRows(summaries)
      setError(null)
    } catch {
      setError('Could not load sessions — is the backend reachable?')
      setRows([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const view = useMemo(() => {
    if (!rows) return []
    const q = filter.trim().toLowerCase()
    const filtered = q
      ? rows.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            (r.dominant_stage ?? '').toLowerCase().includes(q) ||
            r.preset.toLowerCase().includes(q),
        )
      : rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let av: number, bv: number
      if (sortKey === 'duration') { av = a.duration_s ?? 0; bv = b.duration_s ?? 0 }
      else if (sortKey === 'eligible') { av = a.ea1_eligible_seconds ?? 0; bv = b.ea1_eligible_seconds ?? 0 }
      else { av = a.started_at ? Date.parse(a.started_at) : 0; bv = b.started_at ? Date.parse(b.started_at) : 0 }
      return (av - bv) * dir
    })
  }, [rows, filter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortLabel = (key: SortKey, label: string) =>
    `${label}${sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}`

  return (
    <Card
      title="Session history"
      subtitle="Recorded sessions · click a row to review"
      actions={<button type="button" className="nl-btn" onClick={load}>refresh</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Filter by label / stage / preset…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1, minWidth: 180, background: 'var(--bg-void)', color: 'var(--ink-primary)',
            border: '1px solid var(--stroke-veil)', borderRadius: 'var(--radius-sm)', padding: '6px 10px',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="nl-btn" onClick={() => toggleSort('date')} style={{ fontSize: 12 }}>{sortLabel('date', 'date')}</button>
          <button type="button" className="nl-btn" onClick={() => toggleSort('duration')} style={{ fontSize: 12 }}>{sortLabel('duration', 'duration')}</button>
          <button type="button" className="nl-btn" onClick={() => toggleSort('eligible')} style={{ fontSize: 12 }}>{sortLabel('eligible', 'EA-1 s')}</button>
        </div>
      </div>

      {!rows ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Loading sessions…</p>
      ) : error ? (
        <p style={{ color: 'var(--accent-maroon)', marginBottom: 0 }}>{error}</p>
      ) : view.length === 0 ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>No recorded sessions match. Record a session to build history.</p>
      ) : (
        <div className="nl-stack" style={{ gap: 8 }}>
          {view.map((r) => {
            const active = r.id === selectedId
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(r.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(r.id) }}
                style={{
                  background: active ? 'var(--bg-shrine)' : 'var(--bg-void)',
                  border: `1px solid ${active ? 'var(--accent-teal)' : 'var(--stroke-veil)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700 }}>{r.label || `Session ${r.id}`}</span>
                  <span className="nl-whisper font-mono">{fmtDate(r.started_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <StatusPill tone="neutral">{fmtDuration(r.duration_s)}</StatusPill>
                  {r.dominant_stage ? <StatusPill tone="neutral">{r.dominant_stage}</StatusPill> : null}
                  {r.ea1_eligible_seconds != null ? <StatusPill tone="good">EA-1 {r.ea1_eligible_seconds}s</StatusPill> : null}
                  <StatusPill tone="neutral">{r.notes_count} notes</StatusPill>
                  {r.wandering_count > 0 ? <StatusPill tone="warn">{r.wandering_count} wandering</StatusPill> : null}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                  <a className="nl-whisper" href={sessionApi.exportUrl(r.id, 'csv')} target="_blank" rel="noreferrer">export CSV</a>
                  <a className="nl-whisper" href={sessionApi.exportUrl(r.id, 'json')} target="_blank" rel="noreferrer">export JSON</a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
