// Single source of truth for the redesigned shell. Owns the WS connection,
// device-status polling, stream-health polling, recording state, a rolling band
// history, and the derived meditation metrics (mean bands, FAA, s-space) that
// the Practice hero and Signal page consume.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNeurolinkWS } from './useNeurolinkWS'
import { deviceApi, streamApi, meditationApi, ApiError, type MeditationClassifyResult } from '../lib/apiClient'
import type { DeviceCandidate, LastPairedDevice, SignalMode } from '../lib/wire'
import { flattenBandPowersForDisplay, HISTORY_LIMIT } from '../lib/bandpower.js'
import {
  sSpaceRegion,
  alchemicalStage,
  overlayMode,
  engagementIndex,
  integrationCoverage,
} from '../components/sSpace.js'
import type { DeviceStatus, StreamHealth, BandQuality, HrvBlock, BreathingBlock } from '../lib/wire'

export type Ea1Result = MeditationClassifyResult['ea1_result']

export interface MeditationDerived {
  bands: { alpha: number; theta: number; beta: number; delta: number; gamma: number }
  faa: number | null
  region: string
  stage: string
  overlay: string
  engagement: number
  coverage: number
}

const EMPTY_BANDS = { alpha: 0, theta: 0, beta: 0, delta: 0, gamma: 0 }

// localStorage key for the persisted signal-mode selection.
const SIGNAL_MODE_KEY = 'neurolink.signal_mode'
const SIGNAL_MODES: readonly SignalMode[] = ['meditation', 'notch', 'raw']

function readStoredSignalMode(): SignalMode {
  try {
    const v = localStorage.getItem(SIGNAL_MODE_KEY)
    if (v && (SIGNAL_MODES as readonly string[]).includes(v)) return v as SignalMode
  } catch {
    /* localStorage unavailable (SSR/tests) */
  }
  return 'meditation'
}

// Fit-check thresholds: all channels at/below this contact score for this many
// seconds triggers the "adjust headset fit" overlay.
const FIT_CHECK_CONTACT_MAX = 0.05
const FIT_CHECK_SECS = 5

export function useNeurolinkStore() {
  const { frames, status: wsStatus } = useNeurolinkWS(true)
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null)
  const [streamHealth, setStreamHealth] = useState<StreamHealth | null>(null)
  const [streamStatus, setStreamStatus] = useState<'idle' | 'streaming' | 'stopped'>('idle')
  const [recording, setRecording] = useState<{ recording: boolean; path: string }>({ recording: false, path: '' })
  const [bandHistory, setBandHistory] = useState<Array<Record<string, number>>>([])
  const [streamHealthHistory, setStreamHealthHistory] = useState<number[]>([])
  const [signalMode, setSignalModeState] = useState<SignalMode>(readStoredSignalMode)
  const lastEegRef = useRef<unknown>(null)

  // ---- Device control (scan / connect / disconnect) ---------------------
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [scanResults, setScanResults] = useState<DeviceCandidate[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DeviceCandidate | null>(null)
  const [lastPaired, setLastPaired] = useState<LastPairedDevice | null>(null)

  const refreshDevice = useCallback(async () => {
    try {
      setDeviceStatus(await deviceApi.status())
    } catch {
      /* backend offline; leave prior state */
    }
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      const h = await streamApi.health()
      setStreamHealth(h)
      setStreamHealthHistory((prev) => [...prev, Number(h.packet_loss_pct) || 0].slice(-HISTORY_LIMIT))
    } catch {
      /* noop */
    }
  }, [])

  const refreshRecording = useCallback(async () => {
    try {
      const r = await streamApi.recordingState()
      setRecording({ recording: Boolean(r.recording), path: r.path || '' })
    } catch {
      /* noop */
    }
  }, [])

  const refreshLastPaired = useCallback(async () => {
    try {
      const r = await deviceApi.lastPaired()
      setLastPaired(r.device)
    } catch {
      /* backend offline; leave prior state */
    }
  }, [])

  // ---- Signal mode (Meditation / Notch / Raw) ---------------------------
  // setSignalMode fires the API call, then updates local state + localStorage
  // on success so the selection survives reloads and drives page behaviour.
  const setSignalMode = useCallback(async (mode: SignalMode) => {
    try {
      const r = await streamApi.setMode(mode)
      const next = r.mode ?? mode
      setSignalModeState(next)
      try {
        localStorage.setItem(SIGNAL_MODE_KEY, next)
      } catch {
        /* localStorage unavailable */
      }
    } catch {
      /* backend offline; keep prior mode so the UI stays truthful */
    }
  }, [])

  // On mount, push the persisted selection to the backend so it matches the UI.
  useEffect(() => {
    void setSignalMode(readStoredSignalMode())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-sync the mode whenever the WebSocket (re)connects — a backend restart
  // resets to meditation, so the client re-asserts its persisted selection.
  useEffect(() => {
    if (wsStatus === 'open') void setSignalMode(readStoredSignalMode())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus])

  // Device status polls every 2 s, stream health every 1 s (per the brief).
  useEffect(() => {
    refreshDevice()
    refreshRecording()
    refreshLastPaired()
    const d = setInterval(refreshDevice, 2000)
    const h = setInterval(refreshHealth, 1000)
    return () => {
      clearInterval(d)
      clearInterval(h)
    }
  }, [refreshDevice, refreshHealth, refreshRecording, refreshLastPaired])

  // Roll band history off each fresh EEG frame (first channel).
  useEffect(() => {
    const eeg = frames.eeg
    if (!eeg || eeg === lastEegRef.current) return
    lastEegRef.current = eeg
    const flat = flattenBandPowersForDisplay(eeg.band_powers || {})
    const first = Object.values(flat)[0]
    if (first) setBandHistory((prev) => [...prev, first as Record<string, number>].slice(-HISTORY_LIMIT))
  }, [frames.eeg])

  const flattenedBands = useMemo(
    () => flattenBandPowersForDisplay(frames.eeg?.band_powers || {}),
    [frames.eeg],
  )

  const channelNames = useMemo(
    () => frames.eeg?.channel_names || deviceStatus?.channel_names || [],
    [frames.eeg, deviceStatus],
  )

  const bandQuality: Record<string, BandQuality> = useMemo(
    () => frames.eeg?.band_quality || {},
    [frames.eeg],
  )

  const meditation: MeditationDerived = useMemo(() => {
    const channels = Object.values(flattenedBands) as Array<Record<string, number>>
    if (!channels.length) {
      return { bands: EMPTY_BANDS, faa: null, region: 'A', stage: 'Nigredo', overlay: 'X0', engagement: 0, coverage: 0 }
    }
    const sums = { alpha: 0, theta: 0, beta: 0, delta: 0, gamma: 0 }
    for (const b of channels) {
      sums.alpha += Number(b.alpha) || 0
      sums.theta += Number(b.theta) || 0
      sums.beta += Number(b.beta) || 0
      sums.delta += Number(b.delta) || 0
      sums.gamma += Number(b.gamma) || 0
    }
    const n = channels.length
    const bands = {
      alpha: sums.alpha / n, theta: sums.theta / n, beta: sums.beta / n,
      delta: sums.delta / n, gamma: sums.gamma / n,
    }
    const faa = frames.eeg?.pipeline?.faa ?? null
    const region = String(sSpaceRegion(bands.alpha, bands.theta))
    const eng = engagementIndex(bands.alpha, bands.theta, bands.beta)
    return {
      bands, faa, region,
      stage: alchemicalStage(region),
      overlay: overlayMode(region),
      engagement: eng,
      coverage: integrationCoverage(region, eng, faa),
    }
  }, [flattenedBands, frames.eeg])

  // Per-frame derived metrics (frame_metrics.py). Empty maps / nulls before the
  // first usable EEG frame — components render honest "no data" states, never
  // fabricated values.
  const contact: Record<string, number> = useMemo(() => frames.eeg?.contact || {}, [frames.eeg])

  // ---- Fit check (Fix 4) ------------------------------------------------
  // Frontend heuristic: when every channel's contact score sits at/near zero
  // (flat/disconnected OR railing far above the 100 µV EEG ceiling) for a
  // rolling 5 s window, the headset almost certainly isn't in skin contact.
  // Drives the Signal-page overlay + Practice-page banner; clears the instant
  // any channel returns to range.
  const [poorFit, setPoorFit] = useState(false)
  const poorFitStartRef = useRef<number | null>(null)
  useEffect(() => {
    // Fit-check overlay only fires in Meditation mode: in raw/notch the
    // oscilloscope traces are the direct signal feedback, so no overlay.
    if (signalMode !== 'meditation') {
      poorFitStartRef.current = null
      setPoorFit(false)
      return
    }
    const vals = Object.values(contact)
    const allLow = vals.length > 0 && vals.every((v) => v <= FIT_CHECK_CONTACT_MAX)
    if (!allLow) {
      poorFitStartRef.current = null
      setPoorFit(false)
      return
    }
    if (poorFitStartRef.current == null) poorFitStartRef.current = Date.now()
    const elapsedS = (Date.now() - poorFitStartRef.current) / 1000
    setPoorFit(elapsedS >= FIT_CHECK_SECS)
  }, [contact, signalMode])
  const impedance: Record<string, number> = useMemo(() => frames.eeg?.impedance || {}, [frames.eeg])
  const focusState = frames.eeg?.focus_state ?? null
  const focusScore = frames.eeg?.focus_score ?? null
  const fatigue = frames.eeg?.fatigue ?? null

  // Raw per-channel sample buffers (µV) for the spectrogram / topo / connectivity
  // canvas components. Keyed by BrainFlow channel index string.
  const rawEeg: Record<string, number[]> = useMemo(() => frames.eeg?.eeg || {}, [frames.eeg])

  const battery = frames.eeg?.battery ?? deviceStatus?.battery ?? null

  // ---- HRV + breathing (frame_hrv.py) -----------------------------------
  const hrv: HrvBlock | null = frames.eeg?.hrv ?? null
  const breathing: BreathingBlock | null = frames.eeg?.breathing ?? null

  // ---- Shared EA-1 classification ---------------------------------------
  // Classified server-side off the live band means (plus HRV/breath when
  // present) so the gauge, halo, and EA1Score widget all share one result.
  const [ea1, setEa1] = useState<Ea1Result | null>(null)
  const ea1InFlight = useRef(false)
  useEffect(() => {
    if (!frames.eeg || ea1InFlight.current) return
    ea1InFlight.current = true
    const b = meditation.bands
    // The EA-1 breath criterion reads ppg.hr_bpm as the respiratory rate
    // (MuseLink contract), so pass breathing rate there; HRV RMSSD + Poincaré
    // ratio come from the hrv block when available.
    const ppg = hrv
      ? {
          hr_bpm: breathing?.rate_bpm ?? 0,
          hrv_rmssd: hrv.rmssd,
          poincare: { sd1_sd2_ratio: hrv.sd2 > 0 ? hrv.sd1 / hrv.sd2 : 0 },
        }
      : undefined
    meditationApi
      .classify({
        alpha: b.alpha, theta: b.theta, beta: b.beta,
        delta: b.delta, gamma: b.gamma, faa: meditation.faa ?? 0,
        fmt: frames.eeg?.pipeline?.fmt ?? 0,
        ...(ppg ? { ppg } : {}),
      })
      .then((r) => setEa1(r.ea1_result))
      .catch(() => { /* backend offline; keep prior result */ })
      .finally(() => { ea1InFlight.current = false })
  }, [frames.eeg])

  // ---- Controls ---------------------------------------------------------
  const startStream = useCallback(async () => {
    try {
      const r = await streamApi.start()
      if (r.status) setStreamStatus('streaming')
      setDeviceError(null)
    } catch (e) {
      // 409 = device not connected; surface it so the user knows to connect.
      setDeviceError(e instanceof ApiError ? e.message : 'Could not start stream')
    }
    await refreshDevice()
  }, [refreshDevice])

  const stopStream = useCallback(async () => {
    try {
      await streamApi.stop()
      setStreamStatus('stopped')
    } catch (e) {
      // 409 = not streaming; treat as already-stopped, no scary error.
      if (e instanceof ApiError && e.status === 409) setStreamStatus('stopped')
      else setDeviceError(e instanceof ApiError ? e.message : 'Could not stop stream')
    }
    await refreshDevice()
  }, [refreshDevice])

  const startRecording = useCallback(async () => {
    const r = await streamApi.startRecording()
    setRecording({ recording: Boolean(r.recording), path: r.path || '' })
  }, [])

  const stopRecording = useCallback(async () => {
    const r = await streamApi.stopRecording()
    setRecording({ recording: Boolean(r.recording), path: r.path || '' })
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setDeviceError(null)
    try {
      const r = await deviceApi.scan()
      setScanResults(r.devices)
      if (r.devices.length && !selectedDevice) setSelectedDevice(r.devices[0])
      return r.devices
    } catch (e) {
      setDeviceError(e instanceof ApiError ? e.message : 'Scan failed')
      return []
    } finally {
      setScanning(false)
    }
  }, [selectedDevice])

  // Connect to an explicit address, else the selected scan result, else the
  // last-paired device. A 409 already-connected is a normal no-op, not an error.
  const connect = useCallback(async (address?: string) => {
    const target = address ?? selectedDevice?.address ?? lastPaired?.ble_address
    setConnecting(true)
    setDeviceError(null)
    try {
      await deviceApi.connect({
        ble_address: target,
        display_name: selectedDevice?.name ?? lastPaired?.display_name,
      })
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) {
        setDeviceError(e instanceof ApiError ? e.message : 'Connect failed')
      }
    } finally {
      setConnecting(false)
    }
    await refreshDevice()
    await refreshLastPaired()
  }, [refreshDevice, refreshLastPaired, selectedDevice, lastPaired])

  const disconnect = useCallback(async () => {
    setDeviceError(null)
    try {
      await deviceApi.disconnect()
    } catch (e) {
      setDeviceError(e instanceof ApiError ? e.message : 'Disconnect failed')
    }
    setStreamStatus('idle')
    await refreshDevice()
  }, [refreshDevice])

  return {
    frames, wsStatus,
    deviceStatus, streamHealth, streamHealthHistory, streamStatus, recording,
    flattenedBands, channelNames, bandQuality, bandHistory,
    contact, impedance, focusState, focusScore, fatigue, rawEeg,
    meditation, battery, hrv, breathing, ea1,
    connect, disconnect, startStream, stopStream, startRecording, stopRecording,
    refreshDevice, refreshHealth, refreshRecording, refreshLastPaired,
    // Device control
    deviceError, scanning, connecting, scanResults, selectedDevice, setSelectedDevice,
    lastPaired, scan, clearDeviceError: () => setDeviceError(null),
    // Fit check
    poorFit,
    // Signal mode
    signalMode, setSignalMode,
  }
}

export type NeurolinkStore = ReturnType<typeof useNeurolinkStore>
