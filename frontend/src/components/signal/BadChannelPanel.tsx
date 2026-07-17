import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { TONE_GOOD, TONE_BAD } from '../../lib/vajra'
import { signalApi, type BadChannelRecord } from '../../lib/apiClient'
import type { BadChannelState } from '../../lib/wire'

// BadChannelPanel — per-electrode bad-channel state for the Signal page.
//
// The live frame carries the Stage-2 detector's verdict (`bad_channels`:
// flagged names, per-channel reason, spherical-spline interpolation flag). We
// merge that with the REST snapshot from GET /api/signal/bad-channels so every
// Athena electrode (TP9/AF7/AF8/TP10/AUX) is listed even when clean, and expose
// a manual-override toggle (POST /api/signal/bad-channels/manual). Reasons come
// straight from the detector — variance / kurtosis / correlation / flat-line —
// never fabricated.

interface Props {
  badChannels?: BadChannelState
}

const REASON_LABEL: Record<string, string> = {
  ok: 'within tolerance',
  manual: 'manual override',
  flat_line: 'flat line (no variance)',
  noisy: 'excess variance / kurtosis',
}

function humanReason(reason: string): string {
  if (!reason) return ''
  return reason
    .split(',')
    .map((r) => REASON_LABEL[r.trim()] ?? r.trim())
    .join(' · ')
}

export function BadChannelPanel({ badChannels }: Props) {
  const [records, setRecords] = useState<BadChannelRecord[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const r = await signalApi.badChannels()
      setRecords(r.channels)
      setError(null)
    } catch {
      /* backend offline; keep prior snapshot */
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  const toggle = useCallback(
    async (channel: string, bad: boolean) => {
      setPending(channel)
      setError(null)
      try {
        const r = await signalApi.setManualBad(channel, bad)
        setRecords(r.channels)
      } catch {
        setError(`Could not update ${channel}`)
      } finally {
        setPending(null)
      }
    },
    [],
  )

  // Live frame overrides the REST snapshot's flagged set when present.
  const liveFlagged = useMemo(
    () => new Set(badChannels?.flagged ?? []),
    [badChannels],
  )
  const liveReasons = badChannels?.reasons ?? {}
  const interpolation = badChannels?.interpolation_active ?? false

  if (!records) {
    return (
      <Card title="Bad Channels" subtitle="Stage-2 detector · per electrode">
        <p className="nl-muted" style={{ marginBottom: 0 }}>
          Insufficient data — start the stream to evaluate channel quality.
        </p>
      </Card>
    )
  }

  const flaggedCount = records.filter(
    (c) => c.is_bad || liveFlagged.has(c.name),
  ).length

  return (
    <Card
      title="Bad Channels"
      subtitle="Stage-2 detector · variance / kurtosis / correlation / flat-line"
      actions={
        <span className="nl-whisper" style={{ color: interpolation ? TONE_BAD : TONE_GOOD }}>
          {interpolation ? 'spline interpolation active' : 'no interpolation'}
        </span>
      }
    >
      <div className="nl-stack" style={{ gap: 8 }}>
        {records.map((c) => {
          const bad = c.is_bad || liveFlagged.has(c.name)
          const color = bad ? TONE_BAD : TONE_GOOD
          const reason = humanReason(liveReasons[c.name] ?? c.reason)
          const busy = pending === c.name
          return (
            <div
              key={c.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: 'var(--bg-void)',
                border: `1px solid ${bad ? color : 'var(--stroke-veil)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span
                  className="nl-dot"
                  style={{ background: color, width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }}
                />
                <span
                  className="font-mono"
                  style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {c.name}
                </span>
                <span className="nl-whisper" style={{ color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {bad ? reason || 'flagged' : 'clean'}
                </span>
              </div>
              <button
                type="button"
                className="nl-btn"
                disabled={busy}
                onClick={() => toggle(c.name, !c.manual_bad)}
                style={{
                  fontSize: 12,
                  opacity: busy ? 0.5 : 1,
                  color: c.manual_bad ? TONE_BAD : undefined,
                }}
              >
                {c.manual_bad ? 'clear override' : 'mark bad'}
              </button>
            </div>
          )
        })}
      </div>
      <div
        className="font-mono nl-muted"
        style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--stroke-veil)', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}
      >
        <span>{flaggedCount} of {records.length} flagged</span>
        {error ? <span style={{ color: TONE_BAD }}>{error}</span> : null}
      </div>
    </Card>
  )
}
