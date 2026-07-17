// Shared Tier-B (meditation) frontend types. Wire-format types live in
// lib/wire.ts; this file holds component/hook-facing types built on top of them.

export type { HrvBlock, BreathingBlock, EegFrame } from './wire'
export type { Ea1Result } from '../hooks/useNeurolinkStore'
export type {
  SessionGoalRecord,
  JournalNoteRecord,
  MeditationClassifyResult,
} from './apiClient'

// ---- Audio feedback -----------------------------------------------------
export type Soundscape =
  | 'silence'
  | 'singing-bowl'
  | 'alpha-binaural'
  | 'theta-binaural'
  | 'guided-breath'

export interface AudioFeedbackState {
  muted: boolean
  volume: number // 0..1
  soundscape: Soundscape
}

// ---- HRV coherence ------------------------------------------------------
export interface CoherenceSample {
  t: number // ms epoch
  coherence: number // 0..1
  hr: number // instantaneous HR (bpm) from latest IBI
}

// ---- Wandering detector -------------------------------------------------
export interface WanderingEvent {
  id: string
  t: number // ms epoch
  intensity: number // 0..1 — how far the trajectory jumped
  tag?: string
}

// ---- Alchemical journal -------------------------------------------------
export const ALCHEMICAL_STAGES = [
  'Nigredo',
  'Albedo',
  'Citrinitas',
  'Rubedo',
  'Conjunctio',
] as const
export type AlchemicalStage = (typeof ALCHEMICAL_STAGES)[number]

export interface StageTransition {
  stage: string
  t: number // ms epoch when the stage was entered
}

// ---- Meditation timer ---------------------------------------------------
export type TimerPhase = 'settling' | 'main' | 'dedication' | 'complete'

export interface TimerPhaseSpec {
  phase: TimerPhase
  seconds: number
}
