// Motion tokens for the Vajra Night theme. Global easing + durations, plus the
// signature gold breath-halo cadence (5.5 breaths/min => ~10.9 s period).

export const EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)'
export const DURATION_BASE_MS = 240
export const DURATION_CEREMONIAL_MS = 800

export const BREATH_CADENCE_BPM = 5.5
export const BREATH_PERIOD_MS = (60 / BREATH_CADENCE_BPM) * 1000 // ~10909 ms

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export const transition = (
  props = 'all',
  ms: number = DURATION_BASE_MS,
  easing: string = EASING,
): string => `${props} ${ms}ms ${easing}`
