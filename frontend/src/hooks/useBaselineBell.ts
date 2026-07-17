// A recurring "return to baseline" mindfulness bell. Fires onRing on a fixed
// cadence while enabled; the consumer wires onRing to an audible chime
// (useAudioFeedback.playChime). Kept transport-free so it is trivially testable
// with fake timers.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface BaselineBell {
  lastRing: number | null
  ringNow: () => void
}

export function useBaselineBell({
  enabled,
  intervalMs,
  onRing,
}: {
  enabled: boolean
  intervalMs: number
  onRing: () => void
}): BaselineBell {
  const [lastRing, setLastRing] = useState<number | null>(null)
  const onRingRef = useRef(onRing)
  onRingRef.current = onRing

  const ringNow = useCallback(() => {
    onRingRef.current()
    setLastRing(Date.now())
  }, [])

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return
    const id = setInterval(() => {
      onRingRef.current()
      setLastRing(Date.now())
    }, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])

  return { lastRing, ringNow }
}
