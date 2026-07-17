import React from 'react'
import { Card, StatusPill } from '../ui/Card'
import { makePath } from '../../lib/bandpower.js'
import type { StreamHealth, PipelinePayload } from '../../lib/wire'
import { TONE_GOOD, TONE_WARN, TONE_BAD } from '../../lib/vajra'

// SignalPipelinePanel — live StreamHealth widget.
//
// Reads the /api/stream/health snapshot (polled 1 s in the store) plus the
// per-frame pipeline payload. Surfaces frame counters, packet loss, tick
// latency, last-frame age, the current artifact-gate decision, and a 60-sample
// packet-loss sparkline. Every number is bound to a real health poll.

interface Props {
  health: StreamHealth | null
  history: number[]
  pipeline: PipelinePayload | undefined
}

function lossTone(pct: number): string {
  if (pct >= 30) return TONE_BAD
  if (pct >= 10) return TONE_WARN
  return TONE_GOOD
}

function ageLabel(lastTs: number): string {
  if (!lastTs) return '—'
  const age = Date.now() / 1000 - lastTs
  if (age < 0 || age > 1e6) return '—'
  return `${age.toFixed(1)}s ago`
}

export function SignalPipelinePanel({ health, history, pipeline }: Props) {
  const loss = health?.packet_loss_pct ?? 0
  const rejected = pipeline?.artifact_rejected ?? false
  const reasons = pipeline?.artifact_reasons ?? []
  const badChannels = pipeline?.bad_channels ?? []
  const w = 240
  const h = 44
  const series = history.map((y, x) => ({ x, y }))
  const maxLoss = Math.max(1, ...history)

  const rows: Array<[string, React.ReactNode]> = [
    ['frames total', health?.frames_total ?? 0],
    ['frames clean', health?.frames_clean ?? 0],
    ['frames rejected', health?.frames_rejected ?? 0],
    ['packet loss', <span style={{ color: lossTone(loss) }}>{loss.toFixed(1)}%</span>],
    ['avg tick', `${(health?.avg_tick_ms ?? 0).toFixed(1)} ms`],
    ['last frame', ageLabel(health?.last_frame_ts ?? 0)],
  ]

  return (
    <Card
      title="Signal pipeline"
      subtitle="Stream health · artifact gate"
      actions={
        <StatusPill tone={rejected ? 'warn' : 'good'}>{rejected ? 'frame rejected' : 'frame accepted'}</StatusPill>
      }
    >
      <dl
        className="font-mono"
        style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13 }}
      >
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="nl-muted">{k}</dt>
            <dd style={{ margin: 0, textAlign: 'right', color: 'var(--ink-primary)' }}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>

      <div style={{ marginTop: 14 }}>
        <div className="nl-whisper" style={{ marginBottom: 4 }}>Packet loss · last {history.length || 0} polls</div>
        {series.length < 2 ? (
          <p className="nl-muted" style={{ margin: 0 }}>Collecting health samples…</p>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-label="Packet loss sparkline">
            <path d={makePath(series, w, h, 0, maxLoss)} fill="none" stroke={lossTone(loss)} strokeWidth="1.5" />
          </svg>
        )}
      </div>

      {(reasons.length > 0 || badChannels.length > 0) && (
        <div className="nl-whisper" style={{ marginTop: 10 }}>
          {reasons.length > 0 && <div>artifact: {reasons.join(' · ')}</div>}
          {badChannels.length > 0 && <div>bad channels: {badChannels.join(', ')}</div>}
        </div>
      )}
    </Card>
  )
}
