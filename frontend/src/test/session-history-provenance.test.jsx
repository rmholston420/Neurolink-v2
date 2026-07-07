import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from '../main.jsx'

const okJson = (data) => ({
  ok: true,
  json: async () => data,
})

describe('Session history provenance rendering', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('shows heuristic metadata hints only for fallback-derived session metadata', async () => {
    global.fetch = vi.fn(async (input) => {
      const raw = typeof input === 'string' ? input : (input?.url ?? String(input))
      const url = raw.replace(/^https?:\/\/[^/]+/, '')

      if (url.includes('/api/stream/recording')) {
        return okJson({
          recording: false,
          path: null,
        })
      }

      if (url.includes('/api/sessions/history/list')) {
        return okJson({
          status: 'ok',
          sessions: [
            {
              session_name: 'legacy-fallback-session',
              timestamp: '2026-07-07T01:00:00Z',
              analyzed: true,
              recording_label: 'short',
              recording_metadata: {
                duration_seconds: 12.3,
                eeg_packets: 48,
                recording_metadata_source: 'fallback',
              },
            },
            {
              session_name: 'manifest-session',
              timestamp: '2026-07-07T01:05:00Z',
              analyzed: true,
              recording_label: 'ok',
              recording_metadata: {
                duration_seconds: 98.4,
                eeg_packets: 412,
                recording_metadata_source: 'manifest',
              },
            },
          ],
        })
      }

      return okJson({})
    })

    render(<App />)

    const fallbackTitle = await screen.findByText('legacy-fallback-session')
    const manifestTitle = await screen.findByText('manifest-session')

    await waitFor(() => {
      expect(screen.getByText('Metadata: heuristic')).toBeInTheDocument()
      expect(screen.getByText('Metadata source: heuristic fallback')).toBeInTheDocument()
    })

    const fallbackSessionBlock = fallbackTitle.closest('div')?.parentElement?.parentElement
    const manifestSessionBlock = manifestTitle.closest('div')?.parentElement?.parentElement

    expect(fallbackSessionBlock).toBeTruthy()
    expect(manifestSessionBlock).toBeTruthy()

    expect(fallbackSessionBlock).toHaveTextContent('Metadata: heuristic')
    expect(fallbackSessionBlock).toHaveTextContent('Short recording')
    expect(manifestSessionBlock).not.toHaveTextContent('Metadata: heuristic')

    expect(screen.getByText('Metadata source: heuristic fallback')).toBeInTheDocument()
    expect(screen.queryAllByText('Metadata source: heuristic fallback')).toHaveLength(1)
  })
})
