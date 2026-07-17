// Inline-style constants extracted verbatim from the original main.jsx.
// Retained so the legacy console (now the Journal page body) renders unchanged
// and the existing provenance tests keep passing during the redesign.

export const card = {
  background: '#131c31',
  padding: 16,
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
}

export const detailChipBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 9px',
  borderRadius: 999,
  fontSize: 12,
  lineHeight: 1.2,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,0.12)',
  border: '1px solid rgba(148,163,184,0.22)',
}

export const QUALITY_STYLES = {
  good: { label: 'good', bg: 'rgba(52, 211, 153, 0.16)', border: 'rgba(52, 211, 153, 0.45)', color: '#86efac' },
  warn: { label: 'warn', bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.45)', color: '#fcd34d' },
  'artifact-likely': { label: 'artifact-likely', bg: 'rgba(248, 113, 113, 0.16)', border: 'rgba(248, 113, 113, 0.45)', color: '#fca5a5' },
  flat: { label: 'flat', bg: 'rgba(148, 163, 184, 0.16)', border: 'rgba(148, 163, 184, 0.45)', color: '#cbd5e1' },
  'insufficient-window': { label: 'insufficient-window', bg: 'rgba(96, 165, 250, 0.16)', border: 'rgba(96, 165, 250, 0.45)', color: '#93c5fd' },
  unknown: { label: 'unknown', bg: 'rgba(148, 163, 184, 0.16)', border: 'rgba(148, 163, 184, 0.45)', color: '#cbd5e1' },
}

export function getStreamHealthStyle(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'running' || key === 'active' || key === 'live') return QUALITY_STYLES.good
  if (key === 'idle' || key === 'stopped') return QUALITY_STYLES.warn
  return QUALITY_STYLES.unknown
}
