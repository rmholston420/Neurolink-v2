// Thin typed wrappers over the v2 REST surface. All URLs are config-driven via
// API_BASE (VITE_API_BASE). Every function maps to a real backend endpoint.
import { API_BASE, API_ORIGIN } from './api.js'
import type { DeviceStatus, StreamHealth, DeviceCandidate, LastPairedDevice } from './wire'

// Thrown on any non-2xx response so callers can branch on HTTP status. The
// backend returns machine-readable 4xx/5xx codes (409 already-connected /
// not-streaming, 400 no-address, 500 backend fault) instead of 200-with-error,
// so the UI can distinguish an expected conflict from a real failure.
export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function parseBody(r: Response): Promise<unknown> {
  const text = await r.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await parseBody(r)
  if (!r.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : r.statusText) || `HTTP ${r.status}`
    throw new ApiError(r.status, data, msg)
  }
  return data as T
}

async function getJson<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

async function sendJson<T>(method: 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return request<T>(method, path, body)
}

// ---- Device -------------------------------------------------------------
export interface ConnectBody {
  ble_address?: string
  display_name?: string
  preset?: string
  board_id?: number
}

export const deviceApi = {
  scan: () => getJson<{ devices: DeviceCandidate[]; count: number }>('/device/scan'),
  connect: (body?: ConnectBody) => postJson<{ status: string; ble_address?: string }>('/device/connect', body ?? {}),
  disconnect: () => postJson<{ status: string }>('/device/disconnect'),
  status: () => getJson<DeviceStatus>('/device/status'),
  lastPaired: () => getJson<{ device: LastPairedDevice | null }>('/device/last-paired'),
}

// ---- Stream -------------------------------------------------------------
export const streamApi = {
  health: () => getJson<StreamHealth>('/stream/health'),
  start: () => postJson<{ status?: string; error?: string }>('/stream/start'),
  stop: () => postJson<{ status?: string }>('/stream/stop'),
  recordingState: () => getJson<{ recording: boolean; path?: string }>('/stream/recording'),
  startRecording: () => postJson<{ recording: boolean; path?: string }>('/stream/recording/start'),
  stopRecording: () => postJson<{ recording: boolean; path?: string }>('/stream/recording/stop'),
}

// ---- Sessions -----------------------------------------------------------
export interface SessionSummary {
  id: number
  label: string
  preset: string
  started_at: string | null
  ended_at: string | null
  duration_s: number | null
}

export interface WanderingEventRecord {
  id: number
  session_id: number | null
  ts: number
  tag: string | null
  note: string | null
  intensity: number | null
  created_at: string
}

export interface SessionAggregate {
  id: number
  label: string
  preset: string
  started_at: string | null
  ended_at: string | null
  duration_s: number | null
  frame_count: number
  notes_count: number
  wandering_count: number
  ea1_eligible_seconds?: number
  dominant_stage?: string
}

export const sessionApi = {
  list: () => getJson<SessionSummary[]>('/sessions/'),
  historyList: () => getJson<{ status: string; sessions: unknown[] }>('/sessions/history/list'),
  detail: (id: string | number) => getJson<Record<string, unknown>>(`/sessions/${encodeURIComponent(String(id))}`),
  summary: (id: string | number) => getJson<SessionAggregate>(`/sessions/${encodeURIComponent(String(id))}/summary`),
  analyzeLatest: () => postJson<Record<string, unknown>>('/sessions/analyze-latest'),
  analyzeByName: (name: string) => postJson<Record<string, unknown>>(`/sessions/analyze-by-name/${encodeURIComponent(name)}`),
  artifactUrl: (filename: string) => `${API_BASE}/sessions/artifacts/${encodeURIComponent(filename)}`,
  listWandering: (id: number | string) =>
    getJson<{ events: WanderingEventRecord[] }>(`/sessions/${encodeURIComponent(String(id))}/wandering-events`),
  createWandering: (
    id: number | string,
    body: { ts: number; tag?: string | null; note?: string | null; intensity?: number | null },
  ) => postJson<WanderingEventRecord>(`/sessions/${encodeURIComponent(String(id))}/wandering-events`, body),
  createUnattachedWandering: (
    body: { ts: number; tag?: string | null; note?: string | null; intensity?: number | null },
  ) => postJson<WanderingEventRecord>('/sessions/wandering-events', body),
  exportUrl: (id: number | string, format: 'csv' | 'json') =>
    `${API_BASE}/sessions/${encodeURIComponent(String(id))}/export?format=${format}`,
  exportJson: (id: number | string) =>
    getJson<Record<string, unknown>>(`/sessions/${encodeURIComponent(String(id))}/export?format=json`),
}

// ---- Signal detail (Tier-C bad-channel override) ------------------------
export interface BadChannelRecord {
  name: string
  is_bad: boolean
  reason: string
  flat_line: boolean
  noisy: boolean
  manual_bad: boolean
}

export const signalApi = {
  badChannels: () => getJson<{ channels: BadChannelRecord[]; flagged: string[] }>('/signal/bad-channels'),
  setManualBad: (channel: string, bad: boolean) =>
    postJson<{ channels: BadChannelRecord[]; flagged: string[] }>('/signal/bad-channels/manual', { channel, bad }),
}

// ---- Meditation ---------------------------------------------------------
export interface Ea1Criterion {
  value: number | null
  threshold: number | null
  range?: [number, number]
  units: string
  met: boolean
}

export interface MeditationClassifyResult {
  region: string
  alchemical_stage: string
  overlay_mode: string
  integration_coverage: number
  engagement_index: number
  ea1_result: {
    eligible: boolean
    score: number
    criteria_met: number
    criteria_total: number
    label: string
    gates: { s_space: boolean; motion: boolean }
    criteria: Record<string, Ea1Criterion>
    s_space_region: string
    overlay_mode: string
    integration_coverage: number
  }
}

export const meditationApi = {
  classify: (payload: unknown) => postJson<MeditationClassifyResult>('/meditation/classify', payload),
  startCalibration: (label: string, durationS: number) =>
    postJson<{ status: string }>('/meditation/calibration/start', { label, duration_s: durationS }),
  saveCalibration: (body: Record<string, number | string>) =>
    postJson<{ status: string; id: number }>('/meditation/calibration/save', body),
  latestCalibration: () => getJson<Record<string, unknown>>('/meditation/calibration/latest'),
  stage0Readiness: () => getJson<Stage0Readiness>('/meditation/stage0-readiness'),
  ackStage0: (body: { step_id?: string; all?: boolean }) =>
    postJson<Stage0Readiness>('/meditation/stage0-readiness/ack', body),
}

// ---- Stage-0 readiness (calibration pre-flight) -------------------------
export interface Stage0Prompt {
  id: string
  title: string
  body: string
  icon: string
  acked: boolean
}

export interface Stage0Readiness {
  acquisition_ready: boolean
  impedance: {
    electrode_type: string
    threshold_kohm: number
    all_channels_ok: boolean
    bad_channels: string[]
    channels: Array<{ label: string; kohm: number | null; level: string; threshold_kohm: number }>
  }
  imu: Record<string, unknown>
  environment: {
    is_ready: boolean
    stabilise_remaining_s: number
    stabilise_complete: boolean
    all_steps_acked: boolean
    acked_steps: string[]
    prompts: Stage0Prompt[]
  }
}

// ---- Practice tracker ---------------------------------------------------
export const practiceApi = {
  postLci: (value: number) => postJson<{ status: string }>('/practice/lci', { value }),
  lciHistory: (n = 50) => getJson<{ history: number[]; mean: number }>(`/practice/lci/history?n=${n}`),
  recommend: () => getJson<{ technique: string; duration_minutes: number; mean_lci: number }>('/practice/recommend'),
}

// ---- Journal & Goals (Tier-B) -------------------------------------------
export interface SessionGoalRecord {
  id: number
  session_id: number | null
  text: string
  metric: string | null
  target: number | null
  progress: number
  achieved: boolean
  created_at: string
}

export interface JournalNoteRecord {
  id: number
  session_id: number | null
  text: string
  stage: string | null
  region: string | null
  created_at: string
}

export const journalApi = {
  listGoals: (sessionId?: number) =>
    getJson<{ goals: SessionGoalRecord[] }>(
      `/journal/goals${sessionId != null ? `?session_id=${sessionId}` : ''}`,
    ),
  createGoal: (body: { text: string; metric?: string | null; target?: number | null; session_id?: number | null }) =>
    postJson<SessionGoalRecord>('/journal/goals', body),
  updateGoal: (id: number, body: { progress?: number; achieved?: boolean; text?: string }) =>
    sendJson<SessionGoalRecord>('PATCH', `/journal/goals/${id}`, body),
  deleteGoal: (id: number) => sendJson<{ status: string; id: number }>('DELETE', `/journal/goals/${id}`),
  listNotes: (sessionId?: number) =>
    getJson<{ notes: JournalNoteRecord[] }>(
      `/journal/notes${sessionId != null ? `?session_id=${sessionId}` : ''}`,
    ),
  createNote: (body: { text: string; stage?: string | null; region?: string | null; session_id?: number | null }) =>
    postJson<JournalNoteRecord>('/journal/notes', body),
}

export { API_ORIGIN }
