// Web Audio soundscapes + ceremonial chimes, synthesized on the fly (no asset
// files). Binaural beats entrain the brain to the *difference* of two carriers
// panned hard L/R; guided-breath swells a warm tone at the breath period; the
// singing bowl is a set of detuned partials. Everything is a no-op when the
// browser has no AudioContext (e.g. jsdom under vitest), so callers can mount
// this unconditionally.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioFeedbackState, Soundscape } from '../lib/types'
import { BREATH_PERIOD_MS } from '../theme/motion'

type AC = AudioContext

// carrier Hz + beat Hz (R − L). ~10 Hz → alpha, ~6 Hz → theta.
const BINAURAL: Partial<Record<Soundscape, { carrier: number; beat: number }>> = {
  'alpha-binaural': { carrier: 220, beat: 10 },
  'theta-binaural': { carrier: 200, beat: 6 },
}

const DEFAULT_STATE: AudioFeedbackState = { muted: false, volume: 0.5, soundscape: 'silence' }

interface Voice {
  stop: () => void
}

export interface AudioFeedback extends AudioFeedbackState {
  setMuted: (m: boolean) => void
  toggleMute: () => void
  setVolume: (v: number) => void
  setSoundscape: (s: Soundscape) => void
  /** Short bell strike for phase/transition cues. semitone offsets the pitch. */
  playChime: (semitone?: number) => void
  supported: boolean
}

function audioSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    (typeof window.AudioContext !== 'undefined' ||
      typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined')
  )
}

function buildBinaural(ctx: AC, master: GainNode, carrier: number, beat: number): Voice {
  const mk = (freq: number, pan: number) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    let node: AudioNode = osc
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      osc.connect(p)
      node = p
    }
    node.connect(master)
    osc.start()
    return osc
  }
  const l = mk(carrier, -1)
  const r = mk(carrier + beat, 1)
  return { stop: () => { l.stop(); r.stop() } }
}

function buildGuidedBreath(ctx: AC, master: GainNode, periodMs: number): Voice {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 174 // low, warm
  const g = ctx.createGain()
  g.gain.value = 0.4
  // LFO swells amplitude once per breath cycle.
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 1000 / periodMs
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.35
  lfo.connect(lfoGain).connect(g.gain)
  osc.connect(g).connect(master)
  osc.start()
  lfo.start()
  return { stop: () => { osc.stop(); lfo.stop() } }
}

function buildSingingBowl(ctx: AC, master: GainNode): Voice {
  const partials = [220, 331, 440, 587]
  const oscs = partials.map((f, i) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.value = 0.22 / (i + 1)
    o.connect(g).connect(master)
    o.start()
    return o
  })
  return { stop: () => oscs.forEach((o) => o.stop()) }
}

export function useAudioFeedback(breathPeriodMs: number = BREATH_PERIOD_MS): AudioFeedback {
  const [state, setState] = useState<AudioFeedbackState>(DEFAULT_STATE)
  const ctxRef = useRef<AC | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const voicesRef = useRef<Voice[]>([])
  const stateRef = useRef(state)
  stateRef.current = state
  const supported = audioSupported()

  const ensureCtx = useCallback((): AC | null => {
    if (!supported) return null
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
      ctxRef.current = ctx
      masterRef.current = master
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {})
    return ctxRef.current
  }, [supported])

  // (Re)build the active soundscape graph on soundscape change.
  useEffect(() => {
    voicesRef.current.forEach((v) => {
      try { v.stop() } catch { /* already stopped */ }
    })
    voicesRef.current = []
    if (state.soundscape === 'silence') return
    const ctx = ensureCtx()
    const master = masterRef.current
    if (!ctx || !master) return
    const bin = BINAURAL[state.soundscape]
    if (bin) voicesRef.current.push(buildBinaural(ctx, master, bin.carrier, bin.beat))
    else if (state.soundscape === 'guided-breath')
      voicesRef.current.push(buildGuidedBreath(ctx, master, breathPeriodMs))
    else if (state.soundscape === 'singing-bowl')
      voicesRef.current.push(buildSingingBowl(ctx, master))
  }, [state.soundscape, breathPeriodMs, ensureCtx])

  // Master gain tracks mute + volume.
  useEffect(() => {
    const master = masterRef.current
    const ctx = ctxRef.current
    if (!master || !ctx) return
    const target = state.muted ? 0 : state.volume * 0.6
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.05)
  }, [state.muted, state.volume])

  // Tear the context down on unmount.
  useEffect(() => {
    return () => {
      voicesRef.current.forEach((v) => {
        try { v.stop() } catch { /* noop */ }
      })
      voicesRef.current = []
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {})
        ctxRef.current = null
        masterRef.current = null
      }
    }
  }, [])

  const playChime = useCallback((semitone = 0) => {
    const ctx = ensureCtx()
    if (!ctx) return
    const s = stateRef.current
    if (s.muted) return
    const now = ctx.currentTime
    const base = 528 * Math.pow(2, semitone / 12)
    ;[1, 2.01, 3.0].forEach((mult, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = base * mult
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime((0.5 / (i + 1)) * s.volume, now + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)
      o.connect(g).connect(ctx.destination)
      o.start(now)
      o.stop(now + 2.5)
    })
  }, [ensureCtx])

  const setMuted = useCallback((m: boolean) => setState((s) => ({ ...s, muted: m })), [])
  const toggleMute = useCallback(() => setState((s) => ({ ...s, muted: !s.muted })), [])
  const setVolume = useCallback(
    (v: number) => setState((s) => ({ ...s, volume: Math.max(0, Math.min(1, v)) })),
    [],
  )
  const setSoundscape = useCallback(
    (sc: Soundscape) => {
      ensureCtx()
      setState((s) => ({ ...s, soundscape: sc }))
    },
    [ensureCtx],
  )

  return { ...state, setMuted, toggleMute, setVolume, setSoundscape, playChime, supported }
}
