// S-space / alchemical-stage classifier — client mirror of the backend
// neurolink_v2.domain.meditation.classifier so the UI can render region and
// stage without a round-trip. Keep thresholds in sync with the Python source.

const REGIONS = [
  ['H', 0.7, 0.7],
  ['G', 0.7, 0.4],
  ['F', 0.7, 0.2],
  ['E', 0.5, 0.7],
  ['D', 0.5, 0.4],
  ['C', 0.5, 0.2],
  ['B', 0.3, 0.4],
  ['A', 0.0, 0.0],
]

const STAGE_MAP = {
  A: 'Nigredo',
  B: 'Albedo',
  C: 'Citrinitas',
  D: 'Citrinitas',
  E: 'Rubedo',
  F: 'Rubedo',
  G: 'Conjunctio',
  H: 'Conjunctio',
}

const OVERLAY_MAP = {
  A: 'X0', B: 'X1', C: 'X2', D: 'X3', E: 'X4', F: 'X5', G: 'X6', H: 'X7',
}

export function sSpaceRegion(alpha, theta) {
  const normA = Math.min((alpha || 0) / 2.0, 1.0)
  const normT = Math.min((theta || 0) / 2.0, 1.0)
  for (const [region, aTh, tTh] of REGIONS) {
    if (normA >= aTh && normT >= tTh) return region
  }
  return 'A'
}

export function alchemicalStage(region) {
  return STAGE_MAP[region] || 'Nigredo'
}

export function overlayMode(region) {
  return OVERLAY_MAP[region] || 'X0'
}

export function engagementIndex(alpha, theta, beta) {
  const denom = (alpha || 0) + (theta || 0)
  if (denom < 1e-9) return 0.0
  return Math.min((beta || 0) / denom, 1.0)
}

export function integrationCoverage(region, eng, faa) {
  const regionScore = (region.charCodeAt(0) - 'A'.charCodeAt(0)) / 7.0
  let faaBonus = 0.0
  if (faa != null && faa > 0) faaBonus = Math.min(faa * 0.3, 0.15)
  return Math.min(regionScore * 0.6 + eng * 0.25 + faaBonus, 1.0)
}
