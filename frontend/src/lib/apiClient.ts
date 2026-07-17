// Thin typed wrappers over the v2 REST surface. All URLs are config-driven via
// API_BASE (VITE_API_BASE). Every function maps to a real backend endpoint.
import { API_BASE, API_ORIGIN } from './api.js'
import type { DeviceStatus, StreamHealth } from './wire'

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`)
  return (await r.json()) as T
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await r.json()) as T
}

async function sendJson<T>(method: 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await r.json()) as T
}

// ---- Device -------------------------------------------------------------
export const deviceApi = {
  scan: () => getJson<{ devices: Array<{ address: string; name?: string }>; count: number }>('/device/scan'),
  connect: () => postJson<{ status: string }>('/device/connect'),
  disconnect: () => postJson<{ status: string }>('/device/disconnect'),
  status: () => getJson<DeviceStatus>('/device/status'),
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
export const sessionApi = {
  list: () => getJson<unknown>('/sessions/'),
  historyList: () => getJson<{ status: string; sessions: unknown[] }>('/sessions/history/list'),
  detail: (id: string) => getJson<unknown>(`/sessions/${encodeURIComponent(id)}`),
  analyzeLatest: () => postJson<Record<string, unknown>>('/sessions/analyze-latest'),
  analyzeByName: (name: string) => postJson<Record<string, unknown>>(`/sessions/analyze-by-name/${encodeURIComponent(name)}`),
  artifactUrl: (filename: string) => `${API_BASE}/sessions/artifacts/${encodeURIComponent(filename)}`,
}

// ---- Meditation ---------------------------------------------------------
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
    criteria: Record<string, unknown>
  }
}

export const meditationApi = {
  classify: (payload: unknown) => postJson<MeditationClassifyResult>('/meditation/classify', payload),
  startCalibration: (label: string, durationS: number) =>
    postJson<{ status: string }>('/meditation/calibration/start', { label, duration_s: durationS }),
  saveCalibration: (body: Record<string, number | string>) =>
    postJson<{ status: string; id: number }>('/meditation/calibration/save', body),
  latestCalibration: () => getJson<Record<string, unknown>>('/meditation/calibration/latest'),
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
