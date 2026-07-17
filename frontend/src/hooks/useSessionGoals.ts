// Persisted meditation session goals (GET/POST/PATCH/DELETE /api/journal/goals).
// Thin optimistic wrapper over journalApi so components stay declarative.
import { useCallback, useEffect, useState } from 'react'
import { journalApi, type SessionGoalRecord } from '../lib/apiClient'

export interface SessionGoals {
  goals: SessionGoalRecord[]
  loaded: boolean
  addGoal: (text: string, metric?: string | null, target?: number | null) => Promise<void>
  updateGoal: (id: number, patch: { progress?: number; achieved?: boolean; text?: string }) => Promise<void>
  deleteGoal: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useSessionGoals(): SessionGoals {
  const [goals, setGoals] = useState<SessionGoalRecord[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await journalApi.listGoals()
      setGoals(Array.isArray(r.goals) ? r.goals : [])
    } catch {
      /* backend offline; keep prior */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addGoal = useCallback(
    async (text: string, metric?: string | null, target?: number | null) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const created = await journalApi.createGoal({ text: trimmed, metric: metric ?? null, target: target ?? null })
      setGoals((prev) => [...prev, created])
    },
    [],
  )

  const updateGoal = useCallback(
    async (id: number, patch: { progress?: number; achieved?: boolean; text?: string }) => {
      const updated = await journalApi.updateGoal(id, patch)
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
    },
    [],
  )

  const deleteGoal = useCallback(async (id: number) => {
    await journalApi.deleteGoal(id)
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }, [])

  return { goals, loaded, addGoal, updateGoal, deleteGoal, refresh }
}
