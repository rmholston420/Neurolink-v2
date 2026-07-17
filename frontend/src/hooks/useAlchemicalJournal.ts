// Tracks the alchemical stage progression (Nigredo → Albedo → Citrinitas →
// Rubedo → Conjunctio) as the derived stage changes, and owns the persisted
// journal notes (GET/POST /api/journal/notes). Transitions are session-local;
// notes are durable.
import { useCallback, useEffect, useRef, useState } from 'react'
import { journalApi, type JournalNoteRecord } from '../lib/apiClient'
import type { StageTransition } from '../lib/types'

export interface AlchemicalJournal {
  stage: string | null
  transitions: StageTransition[]
  notes: JournalNoteRecord[]
  loaded: boolean
  addNote: (text: string, region?: string | null) => Promise<void>
  refreshNotes: () => Promise<void>
}

export function useAlchemicalJournal(
  currentStage: string | null,
  currentRegion?: string | null,
): AlchemicalJournal {
  const [transitions, setTransitions] = useState<StageTransition[]>([])
  const [notes, setNotes] = useState<JournalNoteRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const lastStageRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentStage) return
    if (currentStage === lastStageRef.current) return
    lastStageRef.current = currentStage
    setTransitions((prev) => [...prev, { stage: currentStage, t: Date.now() }])
  }, [currentStage])

  const refreshNotes = useCallback(async () => {
    try {
      const r = await journalApi.listNotes()
      setNotes(Array.isArray(r.notes) ? r.notes : [])
    } catch {
      /* backend offline; keep prior */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refreshNotes()
  }, [refreshNotes])

  const addNote = useCallback(
    async (text: string, region?: string | null) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const created = await journalApi.createNote({
        text: trimmed,
        stage: currentStage,
        region: region ?? currentRegion ?? null,
      })
      setNotes((prev) => [created, ...prev])
    },
    [currentStage, currentRegion],
  )

  return { stage: currentStage, transitions, notes, loaded, addNote, refreshNotes }
}
