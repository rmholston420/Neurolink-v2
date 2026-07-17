import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import type { SessionAggregate, SessionSummary } from '../lib/apiClient'

// Ported from the v1 `session-history-provenance.test.jsx`, which targeted the
// retired v1 console Journal DOM. This rebuild asserts the same provenance /
// session-metadata expectations (name, timestamp, duration, EA-1 seconds,
// export links) against the current TypeScript `SessionHistoryPanel`, which
// enriches `GET /api/sessions/` rows with `GET /api/sessions/{id}/summary`.

vi.mock('../lib/apiClient', () => ({
  sessionApi: {
    list: vi.fn(),
    summary: vi.fn(),
    exportUrl: vi.fn(
      (id: number | string, format: 'csv' | 'json') =>
        `/api/sessions/${id}/export?format=${format}`,
    ),
  },
}))

import { sessionApi } from '../lib/apiClient'
import { SessionHistoryPanel } from '../components/journal/SessionHistoryPanel'

const STARTED_AT = '2026-07-15T14:30:00.000Z'

const LIST: SessionSummary[] = [
  {
    id: 42,
    label: 'Morning Sit',
    preset: 'meditation',
    started_at: STARTED_AT,
    ended_at: '2026-07-15T14:42:30.000Z',
    duration_s: 750,
  },
]

const SUMMARY: SessionAggregate = {
  id: 42,
  label: 'Morning Sit',
  preset: 'meditation',
  started_at: STARTED_AT,
  ended_at: '2026-07-15T14:42:30.000Z',
  duration_s: 750,
  frame_count: 15000,
  notes_count: 3,
  wandering_count: 2,
  ea1_eligible_seconds: 420,
  dominant_stage: 'Rubedo',
}

describe('SessionHistoryPanel provenance', () => {
  beforeEach(() => {
    vi.mocked(sessionApi.list).mockResolvedValue(LIST)
    vi.mocked(sessionApi.summary).mockResolvedValue(SUMMARY)
  })

  it('renders session name, timestamp, duration, and EA-1 seconds from /api/sessions/', async () => {
    render(<SessionHistoryPanel selectedId={null} onSelect={() => {}} />)

    // Session name (provenance identity)
    const name = await screen.findByText('Morning Sit')
    expect(name).toBeInTheDocument()

    // Timestamp — rendered via toLocaleString of the started_at ISO
    const expectedTs = new Date(STARTED_AT).toLocaleString()
    expect(screen.getByText(expectedTs)).toBeInTheDocument()

    // Duration — 750s → "12m 30s"
    expect(screen.getByText('12m 30s')).toBeInTheDocument()

    // EA-1 eligible seconds
    expect(screen.getByText('EA-1 420s')).toBeInTheDocument()

    // Dominant alchemical stage + note count metadata
    expect(screen.getByText('Rubedo')).toBeInTheDocument()
    expect(screen.getByText('3 notes')).toBeInTheDocument()
  })

  it('exposes per-session CSV / JSON export links tied to the session id', async () => {
    render(<SessionHistoryPanel selectedId={null} onSelect={() => {}} />)

    const csv = await screen.findByText('export CSV')
    const json = screen.getByText('export JSON')
    expect(csv).toHaveAttribute('href', '/api/sessions/42/export?format=csv')
    expect(json).toHaveAttribute('href', '/api/sessions/42/export?format=json')
  })

  it('falls back to a synthetic name and dashes when metadata is absent', async () => {
    vi.mocked(sessionApi.list).mockResolvedValue([
      { id: 7, label: '', preset: '', started_at: null, ended_at: null, duration_s: null },
    ])
    vi.mocked(sessionApi.summary).mockResolvedValue({
      id: 7, label: '', preset: '', started_at: null, ended_at: null, duration_s: null,
      frame_count: 0, notes_count: 0, wandering_count: 0,
    })

    render(<SessionHistoryPanel selectedId={null} onSelect={() => {}} />)

    const row = await screen.findByText('Session 7')
    const card = row.closest('[role="button"]') as HTMLElement
    // Missing started_at and duration_s both render an em-dash placeholder.
    expect(within(card).getAllByText('—')).toHaveLength(2)
    expect(within(card).getByText('0 notes')).toBeInTheDocument()
  })
})
