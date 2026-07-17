import React from 'react'
import { LegacyConsole } from './LegacyConsole.jsx'

// Journal hosts the full operator console (session history, provenance, analysis)
// ported verbatim from v1. It owns its own WS + device/session state, preserving
// the review/provenance surface while the new shell drives Practice and Signal.
export function JournalPage() {
  return (
    <div className="nl-page nl-page-journal">
      <LegacyConsole />
    </div>
  )
}
