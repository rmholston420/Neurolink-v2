import React from 'react'
import { Card } from '../ui/Card'
import { useWanderingDetector } from '../../hooks/useWanderingDetector'

// Attention-wandering log. Feeds a small feature vector (band means + engagement)
// to the detector and lists the moments the trajectory jumped — each taggable
// with the flavor of distraction so patterns surface over a session.

const TAGS = ['planning', 'memory', 'body', 'emotion', 'drowsy']

function timeOf(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function WanderingLog({ vector }: { vector: number[] | null }) {
  const { events, tag, clear } = useWanderingDetector(vector)

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
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-void)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ width: `${e.intensity * 100}%`, height: '100%', background: 'var(--accent-lotus)' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => tag(e.id, t)}
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
