import React, { useCallback, useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { practiceApi } from '../../lib/apiClient'
import { makePath } from '../../lib/bandpower.js'

interface Recommendation {
  technique: string
  duration_minutes: number
  mean_lci: number
}

// Practice tracker wired to the real /practice endpoints. Logs the current
// coverage as an LCI sample, then refreshes history + the adaptive
// recommendation so the athlete sees the next suggested technique/duration.
export function PracticeTracker({ coverage }: { coverage: number }) {
  const [history, setHistory] = useState<number[]>([])
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [h, r] = await Promise.all([practiceApi.lciHistory(50), practiceApi.recommend()])
      setHistory(h.history || [])
      setRec(r)
    } catch {
      /* backend offline */
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const logSession = useCallback(async () => {
    setSaving(true)
    try {
      await practiceApi.postLci(Number(coverage.toFixed(4)))
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [coverage, refresh])

  const w = 260
  const h = 60
  const max = Math.max(1, ...history)
  const path = makePath(history.map((v, i) => ({ x: i, y: v })), w, h, 0, max)

  return (
    <Card
      title="Practice tracker"
      subtitle="Lucidity–Coherence Index over sessions"
      actions={
        <button className="nl-btn nl-btn-primary" onClick={logSession} disabled={saving}>
          {saving ? 'Logging…' : 'Log this session'}
        </button>
      }
    >
      {history.length > 1 ? (
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="LCI trend">
          <path d={path} fill="none" stroke="var(--accent-teal)" strokeWidth="2" />
        </svg>
      ) : (
        <p className="nl-muted">Log a session to start your LCI trend.</p>
      )}
      {rec && (
        <dl className="font-mono" style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13 }}>
          <dt className="nl-muted">Suggested technique</dt><dd style={{ margin: 0, textAlign: 'right' }}>{rec.technique}</dd>
          <dt className="nl-muted">Suggested duration</dt><dd style={{ margin: 0, textAlign: 'right' }}>{rec.duration_minutes} min</dd>
          <dt className="nl-muted">Mean LCI</dt><dd style={{ margin: 0, textAlign: 'right' }}>{(rec.mean_lci * 100).toFixed(0)}%</dd>
        </dl>
      )}
    </Card>
  )
}
