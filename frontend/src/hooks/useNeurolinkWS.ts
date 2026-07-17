// WebSocket client for /api/stream/ws. Rewritten from v1's SSE hook: v2 pushes
// JSON frames over a socket, not text/event-stream. Frames are batched into a
// ~33 ms tick (30 fps) so high ingress can't jank React, and delivered to the
// caller as the latest normalized frame set.
import { useEffect, useRef, useState } from 'react'
import { WS_URL } from '../lib/api.js'
import type { EegFrame, ImuFrame, OpticalFrame, WireFrame } from '../lib/wire'

export interface FrameSet {
  eeg: EegFrame | null
  optical: OpticalFrame | null
  imu: ImuFrame | null
}

export type WsStatus = 'connecting' | 'open' | 'closed'

const TICK_MS = 33

export function useNeurolinkWS(enabled = true) {
  const [frames, setFrames] = useState<FrameSet>({ eeg: null, optical: null, imu: null })
  const [status, setStatus] = useState<WsStatus>('closed')
  const pending = useRef<Partial<FrameSet>>({})
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!enabled) return
    let closed = false
    setStatus('connecting')

    let ws: WebSocket
    try {
      ws = new WebSocket(WS_URL)
    } catch {
      setStatus('closed')
      return
    }
    wsRef.current = ws

    ws.onopen = () => !closed && setStatus('open')
    ws.onclose = () => !closed && setStatus('closed')
    ws.onerror = () => !closed && setStatus('closed')
    ws.onmessage = (event: MessageEvent) => {
      let msg: WireFrame
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.type === 'ping') return
      if (msg.type === 'eeg') pending.current.eeg = msg
      else if (msg.type === 'optical') pending.current.optical = msg
      else if (msg.type === 'imu') pending.current.imu = msg
    }

    const tick = setInterval(() => {
      const p = pending.current
      if (p.eeg || p.optical || p.imu) {
        setFrames((prev) => ({
          eeg: p.eeg ?? prev.eeg,
          optical: p.optical ?? prev.optical,
          imu: p.imu ?? prev.imu,
        }))
        pending.current = {}
      }
    }, TICK_MS)

    return () => {
      closed = true
      clearInterval(tick)
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }
  }, [enabled])

  return { frames, status, socket: wsRef }
}
