import React, { useEffect, useRef } from 'react'
import { Card } from '../ui/Card'
import type { SignalMode } from '../../lib/wire'

// RawTraces — oscilloscope panel for the non-meditation signal modes.
//
// Four vertically stacked electrode traces (TP9, AF7, AF8, TP10) drawn on a
// single Canvas 2D surface with a rolling 10 s window. Samples accumulate across
// WS frames into per-channel ring buffers keyed by their frame timestamp, so the
// window scrolls continuously rather than snapping to each 1 s frame buffer.
// Only mounted when signalMode !== 'meditation' (raw / notch fit-checking), so
// this is the direct-signal feedback surface with no DSP interpretation.

const WINDOW_S = 10
const EEG_FS = 256
// Fixed lane order + soft accent per channel (resolved Vajra token hexes).
const LANES: Array<{ label: string; color: string }> = [
  { label: 'TP9', color: '#2fb3a8' }, // teal
  { label: 'AF7', color: '#3b4fe0' }, // indigo
  { label: 'AF8', color: '#d4af37' }, // gold
  { label: 'TP10', color: '#e85a4f' }, // fire
]
const CLIP_UV = 75 // ±75 µV EEG ceiling marker band
const SCALE_DEFAULT = 200 // ±200 µV nominal window
const SCALE_FLOOR = 100 // never present a window tighter than ±100 µV

const CANVAS_W = 640
const LANE_H = 88
const LANE_GAP = 8
const PAD_X = 44
const PAD_TOP = 8
const CANVAS_H = PAD_TOP + LANES.length * LANE_H + (LANES.length - 1) * LANE_GAP + 20

interface Ring {
  t: number[]
  v: number[]
}

interface Props {
  // Per-channel raw sample buffers (µV) for the current frame, keyed by
  // electrode label. Aligned index-for-index with `timestamps`.
  signals: Record<string, number[]>
  // Per-sample timestamps (seconds) for the current frame's buffers.
  timestamps: number[]
  mode: SignalMode
  mainsHz?: number
}

export function RawTraces({ signals, timestamps, mode, mainsHz = 60 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ringsRef = useRef<Record<string, Ring>>({})
  const scaleRef = useRef<number>(SCALE_DEFAULT)
  const lastTsRef = useRef<number>(-Infinity)

  // Append only samples newer than the last-seen timestamp, then trim to 10 s.
  useEffect(() => {
    if (!timestamps || timestamps.length === 0) return
    const maxT = timestamps[timestamps.length - 1]
    if (!Number.isFinite(maxT)) return
    // If the stream time jumped backwards (reconnect / new session), reset.
    if (maxT < lastTsRef.current) {
      ringsRef.current = {}
      lastTsRef.current = -Infinity
    }
    const cutoff = maxT - WINDOW_S
    for (const { label } of LANES) {
      const samples = signals[label]
      if (!Array.isArray(samples) || samples.length === 0) continue
      const ring = (ringsRef.current[label] ??= { t: [], v: [] })
      const n = Math.min(samples.length, timestamps.length)
      for (let i = 0; i < n; i++) {
        const t = timestamps[i]
        if (t > lastTsRef.current) {
          ring.t.push(t)
          ring.v.push(samples[i])
        }
      }
      // Trim to the rolling window.
      let cut = 0
      while (cut < ring.t.length && ring.t[cut] < cutoff) cut++
      if (cut > 0) {
        ring.t.splice(0, cut)
        ring.v.splice(0, cut)
      }
    }
    lastTsRef.current = maxT
  }, [timestamps, signals])

  // Draw whenever fresh samples arrive (frame-rate limited by the WS pump).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      return // jsdom / no 2D context
    }
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    const rings = ringsRef.current
    // Rolling window end = newest timestamp across lanes (fallback: now-domain).
    let maxT = -Infinity
    for (const { label } of LANES) {
      const r = rings[label]
      if (r && r.t.length) maxT = Math.max(maxT, r.t[r.t.length - 1])
    }
    const hasData = Number.isFinite(maxT)
    const windowStart = hasData ? maxT - WINDOW_S : 0

    // Auto-scale: expand to fit peaks, never shrink (floor ±100, default ±200).
    let peak = 0
    for (const { label } of LANES) {
      const r = rings[label]
      if (!r) continue
      for (const v of r.v) {
        const a = Math.abs(v)
        if (a > peak) peak = a
      }
    }
    if (peak * 1.15 > scaleRef.current) scaleRef.current = peak * 1.15
    if (scaleRef.current < SCALE_FLOOR) scaleRef.current = SCALE_FLOOR
    const scale = scaleRef.current

    const plotW = CANVAS_W - PAD_X - 6
    const xOf = (t: number) => PAD_X + ((t - windowStart) / WINDOW_S) * plotW

    LANES.forEach((lane, li) => {
      const top = PAD_TOP + li * (LANE_H + LANE_GAP)
      const center = top + LANE_H / 2
      const half = LANE_H / 2 - 4
      const yOf = (v: number) => center - (v / scale) * half

      // Lane background + baseline.
      ctx.fillStyle = 'rgba(255,255,255,0.015)'
      ctx.fillRect(PAD_X, top, plotW, LANE_H)
      ctx.strokeStyle = 'rgba(237,231,211,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD_X, center)
      ctx.lineTo(PAD_X + plotW, center)
      ctx.stroke()

      // ±75 µV translucent red marker band (only if within the current scale).
      if (CLIP_UV <= scale) {
        const yHi = yOf(CLIP_UV)
        const yLo = yOf(-CLIP_UV)
        ctx.fillStyle = 'rgba(232,90,79,0.10)'
        ctx.fillRect(PAD_X, top, plotW, yHi - top)
        ctx.fillRect(PAD_X, yLo, plotW, top + LANE_H - yLo)
        ctx.strokeStyle = 'rgba(232,90,79,0.55)'
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(PAD_X, yHi)
        ctx.lineTo(PAD_X + plotW, yHi)
        ctx.moveTo(PAD_X, yLo)
        ctx.lineTo(PAD_X + plotW, yLo)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Trace.
      const r = rings[lane.label]
      if (r && r.t.length > 1) {
        ctx.strokeStyle = lane.color
        ctx.lineWidth = 1.25
        ctx.beginPath()
        for (let i = 0; i < r.t.length; i++) {
          const x = xOf(r.t[i])
          const y = yOf(r.v[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Lane label + µV scale.
      ctx.fillStyle = lane.color
      ctx.font = '600 11px var(--font-ui, sans-serif)'
      ctx.textBaseline = 'top'
      ctx.fillText(lane.label, 4, top + 2)
      ctx.fillStyle = 'rgba(237,231,211,0.4)'
      ctx.font = '9px var(--font-ui, sans-serif)'
      ctx.fillText(`+${Math.round(scale)}`, 4, top + 14)
      ctx.textBaseline = 'bottom'
      ctx.fillText(`-${Math.round(scale)}`, 4, top + LANE_H - 2)
      ctx.textBaseline = 'alphabetic'
    })

    // X-axis (seconds). Ticks every 2 s across the 10 s window.
    ctx.fillStyle = 'rgba(237,231,211,0.4)'
    ctx.font = '9px var(--font-ui, sans-serif)'
    ctx.textAlign = 'center'
    const axisY = CANVAS_H - 6
    for (let s = 0; s <= WINDOW_S; s += 2) {
      const x = PAD_X + (s / WINDOW_S) * plotW
      ctx.fillText(`${s - WINDOW_S}s`, x, axisY)
    }
    ctx.textAlign = 'start'
  }, [timestamps, signals])

  const anyData = LANES.some((l) => Array.isArray(signals[l.label]) && signals[l.label].length > 0)
  const badge = mode === 'raw' ? 'RAW' : `NOTCH · ${Math.round(mainsHz)} Hz`

  return (
    <Card
      title="Raw electrode traces"
      subtitle="Oscilloscope · 10 s window · direct signal feedback"
      actions={
        <span
          className="nl-pill"
          style={{
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: mode === 'raw' ? 'var(--accent-fire)' : 'var(--accent-saffron)',
            borderColor: mode === 'raw' ? 'var(--accent-fire)' : 'var(--accent-saffron)',
          }}
        >
          {badge}
        </span>
      }
    >
      <div style={{ background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%' }}
          aria-label="Raw electrode oscilloscope traces"
        />
      </div>
      {!anyData && (
        <p className="nl-muted" style={{ marginBottom: 0 }}>
          No raw samples yet — connect a headset and start the stream.
        </p>
      )}
    </Card>
  )
}
