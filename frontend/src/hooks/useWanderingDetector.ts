// Attention-wandering detector. Watches a small feature vector (band means +
// engagement) and flags moments where the trajectory jumps sharply — the
// signature of the mind darting off the object of meditation. Emits taggable
// events with a cooldown so a single lapse doesn't spam the log.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WanderingEvent } from '../lib/types'

const DEFAULT_THRESHOLD = 0.25
const DEFAULT_COOLDOWN_MS = 4000
const DEFAULT_SCALE = 0.6 // distance mapped to intensity 1.0
const MAX_EVENTS = 100

export function vectorDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export interface WanderingDetector {
  events: WanderingEvent[]
  tag: (id: string, tag: string) => void
  clear: () => void
}

export function useWanderingDetector(
  vec: number[] | null | undefined,
  opts?: { threshold?: number; cooldownMs?: number; scale?: number },
): WanderingDetector {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD
  const cooldownMs = opts?.cooldownMs ?? DEFAULT_COOLDOWN_MS
  const scale = opts?.scale ?? DEFAULT_SCALE

  const [events, setEvents] = useState<WanderingEvent[]>([])
  const prevRef = useRef<number[] | null>(null)
  const lastEventRef = useRef<number>(0)

  useEffect(() => {
    if (!vec || !vec.length) return
    const prev = prevRef.current
    prevRef.current = vec
    if (!prev) return
    const dist = vectorDistance(prev, vec)
    const now = Date.now()
    if (dist >= threshold && now - lastEventRef.current >= cooldownMs) {
      lastEventRef.current = now
      const intensity = Math.max(0, Math.min(1, dist / scale))
      setEvents((prevEvents) =>
        [
          ...prevEvents,
          { id: `${now}-${Math.round(dist * 1000)}`, t: now, intensity },
        ].slice(-MAX_EVENTS),
      )
    }
  }, [vec, threshold, cooldownMs, scale])

  const tag = useCallback((id: string, tag: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, tag } : e)))
  }, [])

  const clear = useCallback(() => setEvents([]), [])

  return { events, tag, clear }
}
