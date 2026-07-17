// Vajra Night palette helpers for the Tier-A visualization components.
//
// CSS variables (theme/tokens.css) drive DOM styling. Canvas 2D and per-datum
// stroke colors can't read CSS vars at paint time, so the hex constants below
// are the *resolved values of the palette tokens* — data-ramp colors derived
// from the tokens, which the brief permits. Keep these in sync with tokens.css.

export const BAND_ORDER = ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const
export type BandName = (typeof BAND_ORDER)[number]

// Band → CSS custom property (for DOM elements that can use var()).
export const BAND_VAR: Record<BandName, string> = {
  delta: 'var(--band-delta)',
  theta: 'var(--band-theta)',
  alpha: 'var(--band-alpha)',
  beta: 'var(--band-beta)',
  gamma: 'var(--band-gamma)',
}

// Band → resolved hex (mirrors tokens.css --band-* → --accent-* chain).
export const BAND_HEX: Record<BandName, string> = {
  delta: '#4b2e83', // accent-deep
  theta: '#c97eb2', // accent-lotus
  alpha: '#2fb3a8', // accent-teal
  beta: '#3b4fe0', // accent-indigo
  gamma: '#e85a4f', // accent-fire
}

export const BAND_GLYPH: Record<BandName, string> = {
  delta: 'δ',
  theta: 'θ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
}

// Palette anchors (resolved token hexes) used to build data ramps.
const TEAL: RGB = [0x2f, 0xb3, 0xa8] // accent-teal
const INDIGO: RGB = [0x3b, 0x4f, 0xe0] // accent-indigo
const FIRE: RGB = [0xe8, 0x5a, 0x4f] // accent-fire
const GOLD: RGB = [0xd4, 0xaf, 0x37] // accent-gold

type RGB = [number, number, number]

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function lerpStops(stops: RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(1, t))
  const seg = 1 / (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x / seg))
  const local = (x - i * seg) / seg
  const a = stops[i]
  const b = stops[i + 1]
  return [lerp(a[0], b[0], local), lerp(a[1], b[1], local), lerp(a[2], b[2], local)]
}

// TopoMap ramp: teal → indigo → fire (cool baseline → hot foci).
export function rampTopo(t: number): string {
  const [r, g, b] = lerpStops([TEAL, INDIGO, FIRE], t)
  return `rgb(${r},${g},${b})`
}

// Spectrogram ramp: viridis-in-Vajra, teal → indigo → fire → gold.
export function rampSpectro(t: number): string {
  const [r, g, b] = lerpStops([TEAL, INDIGO, FIRE, GOLD], t)
  return `rgb(${r},${g},${b})`
}

// Ceremonial state colors shared by gauges / dots.
export const TONE_GOOD = '#2fb3a8' // accent-teal
export const TONE_WARN = '#f5a623' // accent-saffron
export const TONE_BAD = '#8c2f39' // accent-maroon
export const TONE_PEAK = '#d4af37' // accent-gold
