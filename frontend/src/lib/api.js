// Config-driven API base URLs. Collosus runs uvicorn at --port 8008, so the
// default matches without patching. Override with VITE_API_BASE in .env.
const RAW_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  'http://localhost:8008'

// Strip a trailing slash so callers can safely template `${API_BASE}/...`.
const ORIGIN = String(RAW_BASE).replace(/\/+$/, '')

export const API_ORIGIN = ORIGIN
export const API_BASE = `${ORIGIN}/api`

// Derive the WebSocket URL from the same origin (http -> ws, https -> wss).
export const WS_URL = `${ORIGIN.replace(/^http/, 'ws')}/api/stream/ws`
