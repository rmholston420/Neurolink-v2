// Pure band-power helpers extracted from the original main.jsx during the
// Commit-1 split. No React, no side effects — safe to unit test in isolation.

export const BAND_NAMES = ['delta', 'theta', 'alpha', 'beta', 'gamma']

export const BAND_COLORS = {
  delta: '#7dd3fc',
  theta: '#a78bfa',
  alpha: '#34d399',
  beta: '#f59e0b',
  gamma: '#f87171',
}

export const HISTORY_LIMIT = 60

export function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function normalizeBandEntry(entry) {
  if (!entry || typeof entry !== 'object') return null

  const directHasBands = BAND_NAMES.some((name) => entry[name] != null)
  if (directHasBands) {
    const normalized = {}
    for (const name of BAND_NAMES) normalized[name] = clamp01(entry[name] ?? 0)
    return normalized
  }

  for (const value of Object.values(entry)) {
    if (value && typeof value === 'object') {
      const nestedHasBands = BAND_NAMES.some((name) => value[name] != null)
      if (nestedHasBands) {
        const normalized = {}
        for (const name of BAND_NAMES) normalized[name] = clamp01(value[name] ?? 0)
        return normalized
      }
    }
  }

  return null
}

export function flattenBandPowersForDisplay(bandPowers) {
  if (!bandPowers || typeof bandPowers !== 'object') return {}
  const result = {}
  for (const [channel, value] of Object.entries(bandPowers)) {
    const normalized = normalizeBandEntry(value)
    if (normalized) result[channel] = normalized
  }
  return result
}

export function buildBandSeries(history, bandName) {
  return history.map((entry, index) => ({
    x: index,
    y: clamp01(entry?.[bandName] ?? 0),
  }))
}

export function getChartRange(history, bandNames) {
  const values = []
  for (const entry of history) {
    for (const bandName of bandNames) {
      const value = Number(entry?.[bandName])
      if (Number.isFinite(value)) values.push(clamp01(value))
    }
  }

  if (!values.length) {
    return { min: 0, max: 1 }
  }

  let min = Math.min(...values)
  let max = Math.max(...values)

  if (min === max) {
    const pad = Math.max(0.02, min * 0.2 || 0.02)
    min = Math.max(0, min - pad)
    max = Math.min(1, max + pad)
  } else {
    const pad = Math.max(0.02, (max - min) * 0.2)
    min = Math.max(0, min - pad)
    max = Math.min(1, max + pad)
  }

  if (max <= min) {
    return { min: 0, max: 1 }
  }

  return { min, max }
}

export function makePath(points, width, height, minY, maxY) {
  if (!points.length) return ''
  const maxX = Math.max(points.length - 1, 1)
  const range = Math.max(maxY - minY, 0.0001)

  return points
    .map((point, index) => {
      const x = (point.x / maxX) * width
      const normalizedY = (point.y - minY) / range
      const y = height - normalizedY * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function getChannelLabel(channelKey, channelNames = []) {
  const key = String(channelKey ?? '')
  const numeric = Number(key)

  if (Array.isArray(channelNames) && Number.isInteger(numeric) && numeric >= 0 && numeric < channelNames.length) {
    return channelNames[numeric] || key
  }

  if (Array.isArray(channelNames)) {
    const direct = channelNames.find((name) => String(name) === key)
    if (direct) return direct
  }

  // Fallback frontal-4 labels. Athena's frontal layout is spatially the same;
  // the backend supplies channel_names at runtime, so this only fires before
  // the first frame arrives.
  const fallback = { '0': 'TP9', '1': 'AF7', '2': 'AF8', '3': 'TP10' }
  return fallback[key] || key
}

export function formatQualityLabel(status) {
  if (!status) return 'unknown'
  return String(status).replaceAll('-', ' ')
}

export function getSignalGuidanceHint(summary) {
  if (summary?.guidance_hint && String(summary.guidance_hint).trim()) {
    return summary.guidance_hint
  }
  return 'Mixed spectral profile; focus on comfort, breathing, and headset seating.'
}
