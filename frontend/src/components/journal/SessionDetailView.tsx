import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, StatusPill } from '../ui/Card'
import { sessionApi, journalApi, type JournalNoteRecord, type WanderingEventRecord } from '../../lib/apiClient'
import { BAND_HEX, BAND_ORDER, BAND_GLYPH, TONE_GOOD, TONE_PEAK, TONE_BAD } from '../../lib/vajra'

// SessionDetailView — deep review of one recorded session, driven by the export
// JSON (GET /api/sessions/{id}/export?format=json): an EA-1 score timeline with
// eligibility markers, an alchemical stage-transition ribbon, per-band power
// trajectories, a motion trajectory (the only persisted artifact proxy — raw
// artifact scores are not stored per frame), a tagged wandering timeline, and
// notes (read + append). Analysis actions (analyze-latest / analyze-by-name +
// artifact downloads) operate on the raw JSONL recordings via history/list.
// Every panel renders an explicit insufficient-data state; nothing is faked.

interface Frame {
  ts: number
  alpha: number; theta: number; beta: number; delta: number; gamma: number
  faa: number | null; fmt: number | null
  region: string | null; stage: string | null
  ea1_score: number | null; ea1_eligible: number | null
  hrv_rmssd: number | null; rr_bpm: number | null; motion_rms: number | null
}

interface ExportBundle {
  session: { id: number; label: string; preset: string; started_at: string | null; ended_at: string | null; duration_s: number | null }
  frames: Frame[]
  wandering_events: WanderingEventRecord[]
  notes: JournalNoteRecord[]
}

const STAGE_COLOR: Record<string, string> = {
  Nigredo: '#4b2e83',
  Albedo: '#2fb3a8',
  Citrinitas: '#d4af37',
  Rubedo: '#e85a4f',
  Conjunctio: '#c97eb2',
}

const TAG_COLOR: Record<string, string> = {
  planning: '#3b4fe0',
  memory: '#c97eb2',
  body: '#2fb3a8',
  emotion: '#e85a4f',
  drowsy: '#d4af37',
}

function Sparkline({ values, color, height = 40 }: { values: Array<number | null>; color: string; height?: number }) {
  const nums = values.map((v) => (v == null ? NaN : v))
  const finite = nums.filter((v) => Number.isFinite(v)) as number[]
  if (finite.length < 2) return <p className="nl-whisper" style={{ margin: 0 }}>insufficient data</p>
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min || 1
  const w = 100
  const pts = nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * w
    const y = Number.isFinite(v) ? height - ((v - min) / span) * height : NaN
    return { x, y }
  })
  let d = ''
  let pen = false
  for (const p of pts) {
    if (!Number.isFinite(p.y)) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)} `
    pen = true
  }
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function SessionDetailView({ sessionId }: { sessionId: number | null }) {
  const [bundle, setBundle] = useState<ExportBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<JournalNoteRecord[]>([])
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const loadNotes = useCallback(async (id: number) => {
    try {
      const r = await journalApi.listNotes(id)
      setNotes(r.notes)
    } catch { /* keep prior */ }
  }, [])

  useEffect(() => {
    if (sessionId == null) { setBundle(null); return }
    let alive = true
    setLoading(true)
    sessionApi
      .exportJson(sessionId)
      .then((b) => { if (alive) setBundle(b as unknown as ExportBundle) })
      .catch(() => { if (alive) setBundle(null) })
      .finally(() => { if (alive) setLoading(false) })
    loadNotes(sessionId)
    return () => { alive = false }
  }, [sessionId, loadNotes])

  const stages = useMemo(() => {
    if (!bundle?.frames.length) return []
    const segs: Array<{ stage: string; pct: number }> = []
    const n = bundle.frames.length
    let run = 0
    for (let i = 0; i < n; i++) {
      const cur = bundle.frames[i].stage ?? 'unknown'
      const prev = i > 0 ? (bundle.frames[i - 1].stage ?? 'unknown') : cur
      if (cur !== prev) { segs.push({ stage: prev, pct: (run / n) * 100 }); run = 0 }
      run += 1
      if (i === n - 1) segs.push({ stage: cur, pct: (run / n) * 100 })
    }
    return segs
  }, [bundle])

  const submitNote = useCallback(async () => {
    if (sessionId == null || !draft.trim()) return
    setPosting(true)
    try {
      await journalApi.createNote({ text: draft.trim(), session_id: sessionId })
      setDraft('')
      await loadNotes(sessionId)
    } catch { /* surfaced by empty append */ } finally { setPosting(false) }
  }, [draft, sessionId, loadNotes])

  if (sessionId == null) {
    return (
      <Card title="Session detail" subtitle="Select a session to review">
        <p className="nl-muted" style={{ marginBottom: 0 }}>Choose a session from the history to see its timeline.</p>
      </Card>
    )
  }

  if (loading && !bundle) {
    return <Card title="Session detail"><p className="nl-muted" style={{ marginBottom: 0 }}>Loading session…</p></Card>
  }

  if (!bundle) {
    return <Card title="Session detail"><p style={{ color: TONE_BAD, marginBottom: 0 }}>Could not load session {sessionId}.</p></Card>
  }

  const { session, frames, wandering_events } = bundle
  const tMin = frames.length ? frames[0].ts : 0
  const tMax = frames.length ? frames[frames.length - 1].ts : 1
  const tSpan = tMax - tMin || 1

  return (
    <div className="nl-stack" style={{ gap: 16 }}>
      <Card
        title={session.label || `Session ${session.id}`}
        subtitle={`${session.preset} · ${frames.length} frames`}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <a className="nl-whisper" href={sessionApi.exportUrl(session.id, 'csv')} target="_blank" rel="noreferrer">CSV</a>
            <a className="nl-whisper" href={sessionApi.exportUrl(session.id, 'json')} target="_blank" rel="noreferrer">JSON</a>
          </div>
        }
      >
        {/* EA-1 timeline */}
        <div style={{ marginBottom: 16 }}>
          <div className="nl-whisper" style={{ marginBottom: 4 }}>EA-1 score timeline</div>
          <Sparkline values={frames.map((f) => f.ea1_score)} color={TONE_PEAK} />
          <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
            {frames.map((f, i) => (
              <div key={i} style={{ flex: 1, height: 4, background: f.ea1_eligible ? TONE_GOOD : 'var(--stroke-veil)' }} />
            ))}
          </div>
          <div className="nl-whisper" style={{ marginTop: 3 }}>teal ticks = EA-1 eligible frames</div>
        </div>

        {/* Stage-transition ribbon */}
        <div style={{ marginBottom: 16 }}>
          <div className="nl-whisper" style={{ marginBottom: 4 }}>Alchemical stage transitions</div>
          {stages.length ? (
            <>
              <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden' }}>
                {stages.map((s, i) => (
                  <div key={i} title={s.stage} style={{ width: `${s.pct}%`, background: STAGE_COLOR[s.stage] ?? 'var(--stroke-veil)' }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                {Object.keys(STAGE_COLOR).map((st) => (
                  <span key={st} className="nl-whisper" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[st] }} />{st}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="nl-whisper" style={{ margin: 0 }}>insufficient data</p>
          )}
        </div>

        {/* Band trajectories */}
        <div style={{ marginBottom: 16 }}>
          <div className="nl-whisper" style={{ marginBottom: 4 }}>Band power trajectory</div>
          <div className="nl-grid-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {BAND_ORDER.map((b) => (
              <div key={b}>
                <div className="nl-whisper" style={{ color: BAND_HEX[b] }}>{BAND_GLYPH[b]} {b}</div>
                <Sparkline values={frames.map((f) => f[b])} color={BAND_HEX[b]} height={30} />
              </div>
            ))}
          </div>
        </div>

        {/* Motion trajectory (artifact proxy) */}
        <div>
          <div className="nl-whisper" style={{ marginBottom: 4 }}>Motion (RMS) — artifact proxy · per-frame artifact scores are not persisted</div>
          <Sparkline values={frames.map((f) => f.motion_rms)} color={TONE_BAD} height={30} />
        </div>
      </Card>

      {/* Wandering timeline */}
      <Card title="Mind-wandering timeline" subtitle="Tagged episodes over the session">
        {wandering_events.length ? (
          <div>
            <div style={{ position: 'relative', height: 26, background: 'var(--bg-void)', borderRadius: 4 }}>
              {wandering_events.map((e) => {
                const left = ((e.ts - tMin) / tSpan) * 100
                const color = TAG_COLOR[e.tag ?? ''] ?? 'var(--ink-whisper)'
                return (
                  <div
                    key={e.id}
                    title={`${e.tag ?? 'untagged'} @ ${e.ts.toFixed(1)}s${e.note ? ` — ${e.note}` : ''}`}
                    style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, left))}%`, top: 3, width: 3, height: 20, background: color, borderRadius: 2 }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              {Object.keys(TAG_COLOR).map((t) => (
                <span key={t} className="nl-whisper" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: TAG_COLOR[t] }} />{t}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="nl-muted" style={{ marginBottom: 0 }}>No wandering episodes tagged for this session.</p>
        )}
      </Card>

      {/* Notes */}
      <Card title="Notes" subtitle="Reflections tied to this session">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={draft}
            placeholder="Add a note…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNote() }}
            style={{ flex: 1, background: 'var(--bg-void)', color: 'var(--ink-primary)', border: '1px solid var(--stroke-veil)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
          />
          <button type="button" className="nl-btn nl-btn-primary" disabled={posting || !draft.trim()} onClick={submitNote}>add</button>
        </div>
        {notes.length ? (
          <div className="nl-stack" style={{ gap: 6 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ background: 'var(--bg-void)', border: '1px solid var(--stroke-veil)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                <div>{n.text}</div>
                <div className="nl-whisper font-mono" style={{ marginTop: 4 }}>
                  {[n.stage, n.region, n.created_at].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="nl-muted" style={{ marginBottom: 0 }}>No notes yet.</p>
        )}
      </Card>

      <SessionAnalysisPanel />
    </div>
  )
}

// Recording analysis (JSONL files, distinct from DB sessions) ported from the
// retired LegacyConsole review surface: analyze-latest + per-file analyze with
// artifact downloads. Kept in the Journal so provenance/analysis stays reachable.
function SessionAnalysisPanel() {
  const [recordings, setRecordings] = useState<Array<Record<string, unknown>> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await sessionApi.historyList()
      setRecordings(Array.isArray(r.sessions) ? (r.sessions as Array<Record<string, unknown>>) : [])
    } catch { setRecordings([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const analyzeLatest = useCallback(async () => {
    setBusy('__latest__'); setMsg(null)
    try {
      const r = await sessionApi.analyzeLatest()
      setMsg(String(r.status ?? 'done') === 'ok' ? 'Latest recording analyzed.' : 'Analysis returned no summary.')
      await load()
    } catch { setMsg('Analyze-latest failed — backend offline or no recordings.') } finally { setBusy(null) }
  }, [load])

  const analyzeName = useCallback(async (name: string) => {
    setBusy(name); setMsg(null)
    try {
      await sessionApi.analyzeByName(name)
      await load()
    } catch { setMsg(`Analysis failed for ${name}.`) } finally { setBusy(null) }
  }, [load])

  return (
    <Card
      title="Recordings & analysis"
      subtitle="Raw JSONL recordings · run the analyzer and download artifacts"
      actions={<button type="button" className="nl-btn nl-btn-primary" disabled={busy === '__latest__'} onClick={analyzeLatest}>Analyze latest</button>}
    >
      {msg ? <p className="nl-whisper" style={{ marginTop: 0 }}>{msg}</p> : null}
      {!recordings ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>Loading recordings…</p>
      ) : recordings.length === 0 ? (
        <p className="nl-muted" style={{ marginBottom: 0 }}>No JSONL recordings found. Start and stop a recording to create one.</p>
      ) : (
        <div className="nl-stack" style={{ gap: 8 }}>
          {recordings.map((rec) => {
            const name = String(rec.session_name ?? '')
            const analyzed = Boolean(rec.analyzed)
            const bandsPng = rec.bands_png ? String(rec.bands_png).split('/').pop()! : null
            const summaryCsv = rec.summary_csv ? String(rec.summary_csv).split('/').pop()! : null
            const tsCsv = rec.timeseries_csv ? String(rec.timeseries_csv).split('/').pop()! : null
            return (
              <div key={name} style={{ background: 'var(--bg-void)', border: '1px solid var(--stroke-veil)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span className="font-mono" style={{ fontWeight: 700 }}>{name}</span>
                  <span className="nl-whisper font-mono">{String(rec.timestamp ?? '')}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <StatusPill tone={analyzed ? 'good' : 'warn'}>{analyzed ? 'analyzed' : 'recorded only'}</StatusPill>
                  <button type="button" className="nl-btn" style={{ fontSize: 12 }} disabled={busy === name} onClick={() => analyzeName(name)}>
                    {busy === name ? 'analyzing…' : analyzed ? 'reanalyze' : 'analyze'}
                  </button>
                  {bandsPng ? <a className="nl-whisper" href={sessionApi.artifactUrl(bandsPng)} target="_blank" rel="noreferrer">band chart</a> : null}
                  {summaryCsv ? <a className="nl-whisper" href={sessionApi.artifactUrl(summaryCsv)} target="_blank" rel="noreferrer">summary CSV</a> : null}
                  {tsCsv ? <a className="nl-whisper" href={sessionApi.artifactUrl(tsCsv)} target="_blank" rel="noreferrer">timeseries CSV</a> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
