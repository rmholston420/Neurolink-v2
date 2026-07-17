import React, { useState } from 'react'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'
import { SessionHistoryPanel } from '../components/journal/SessionHistoryPanel'
import { SessionDetailView } from '../components/journal/SessionDetailView'

// Journal is the review surface: a server-backed session history on the left and
// a deep per-session detail view (EA-1 / stage / band / wandering timelines,
// notes, export, recording analysis) on the right. Fully rebuilt in TypeScript;
// the v1 console it replaced has been retired.
export function JournalPage(_props: { store: NeurolinkStore }) {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  return (
    <div className="nl-page nl-page-journal">
      <div className="nl-grid-2" style={{ alignItems: 'start' }}>
        <SessionHistoryPanel selectedId={selectedId} onSelect={setSelectedId} />
        <SessionDetailView sessionId={selectedId} />
      </div>
    </div>
  )
}
