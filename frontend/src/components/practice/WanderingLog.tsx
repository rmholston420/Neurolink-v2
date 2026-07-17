import React, { useCallback, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { useWanderingDetector } from '../../hooks/useWanderingDetector'
import { sessionApi } from '../../lib/apiClient'

// Attention-wandering log. Feeds a small feature vector (band means + engagement)
// to the detector and lists the moments the trajectory jumped — each taggable
// with the flavor of distraction so patterns surface over a session. Tagging an
// event persists it in real time via POST /api/sessions/wandering-events (stored
// unattached — the live shell has no DB session row), so the Journal can render
// a wandering history later.

const TAGS = ['planning', 'memory', 'body', 'emotion', 'drowsy']

function timeOf(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function WanderingLog({ vector }: { vector: number[] | null }) {
  const { events, tag, clear } = useWanderingDetector(vector)
  const mountRef = useRef<number>(Date.now())
  const [persisted, setPersisted] = useState<Set<string>>(new Set())

  const tagAndPersist = useCallback(
    (id: string, tagValue: string, t: number, intensity: number) => {
      tag(id, tagValue)
      sessionApi
        .createUnattachedWandering({
          ts: (t - mountRef.current) / 1000,
          tag: tagValue,
          intensity,
        })
        .then(() => setPersisted((prev) => new Set(prev).add(id)))
        .catch(() => { /* backend offline; tag stays local */ })
    },
    [tag],
  )

  return (
    <Card
      title="Wandering log"
      subtitle="Moments the mind moved"
      actions={
        events.length > 0 ? (
          <button className="nl-btn" onClick={clear}>Clear</button>
        ) : undefined
      }
    >
      {events.length === 0 ? (
        <p className="nl-whisper" style={{ marginBottom: 0 }}>
          Steady so far — jumps in the signal will appear here as they happen.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.slice().reverse().slice(0, 10).map((e) => (
            <li key={e.id} style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-shrine-hi)', border: '1px solid var(--stroke-veil)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-primary)' }}>
                  {timeOf(e.t)}
                </span>
                <span className="font-mono nl-whisper" style={{ fontSize: 11 }}>
                  intensity {(e.intensity * 100).toFixed(0)}%
                  {persisted.has(e.id) ? ' · saved' : ''}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-void)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ width: `${e.intensity * 100}%`, height: '100%', background: 'var(--accent-lotus)' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => tagAndPersist(e.id, t, e.t, e.intensity)}
                    aria-pressed={e.tag === t}
                    className="font-mono"
                    style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                      border: `1px solid ${e.tag === t ? 'var(--accent-gold)' : 'var(--stroke-veil)'}`,
                      background: e.tag === t ? 'var(--bg-shrine)' : 'transparent',
                      color: e.tag === t ? 'var(--ink-primary)' : 'var(--ink-muted)',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
