import React, { useMemo } from 'react'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'
import { getChannelLabel } from '../lib/bandpower.js'
import type { BandName } from '../lib/vajra'
import { BandTrend } from '../components/signal/BandTrend'
import { TopoMap } from '../components/signal/TopoMap'
import { RollingSpectrogram } from '../components/signal/RollingSpectrogram'
import { BandPowerChart } from '../components/signal/BandPowerChart'
import { SignalPipelinePanel } from '../components/signal/SignalPipelinePanel'
import { ContactQuality } from '../components/signal/ContactQuality'
import { ImpedancePanel } from '../components/signal/ImpedancePanel'
import { FocusFatigueGauge } from '../components/signal/FocusFatigueGauge'
import { ConnectivityArc } from '../components/signal/ConnectivityArc'
import { DeviceStatusBar } from '../components/signal/DeviceStatusBar'
import { CalibrationPanel } from '../components/signal/CalibrationPanel'

// Signal is the full instrumentation view: every Tier-A visualization bound to
// a real WS frame or REST poll. Per-channel data is re-keyed from BrainFlow
// channel indices to electrode labels here, once, and passed to the leaf
// components as label-keyed maps.
export function SignalPage({ store }: { store: NeurolinkStore }) {
  const {
    flattenedBands,
    rawEeg,
    channelNames,
    bandHistory,
    streamHealth,
    streamHealthHistory,
    contact,
    impedance,
    focusState,
    focusScore,
    fatigue,
    meditation,
    battery,
    deviceStatus,
    frames,
  } = store

  const channelBands = useMemo(() => {
    const out: Record<string, Partial<Record<BandName, number>>> = {}
    for (const [key, bands] of Object.entries(flattenedBands)) {
      out[getChannelLabel(key, channelNames)] = bands as Partial<Record<BandName, number>>
    }
    return out
  }, [flattenedBands, channelNames])

  const signals = useMemo(() => {
    const out: Record<string, number[]> = {}
    for (const [key, samples] of Object.entries(rawEeg)) {
      if (Array.isArray(samples) && samples.length) out[getChannelLabel(key, channelNames)] = samples
    }
    return out
  }, [rawEeg, channelNames])

  const contactMean = useMemo(() => {
    const vals = Object.values(contact)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }, [contact])

  const source = deviceStatus?.transport_metadata?.board_id || null
  const connected = Boolean(deviceStatus?.has_board)

  return (
    <div className="nl-page nl-page-signal">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DeviceStatusBar battery={battery} contactMean={contactMean} source={source} connected={connected} />
      </div>

      <BandTrend history={bandHistory} />

      <div className="nl-grid-2">
        <TopoMap channelBands={channelBands} />
        <div className="nl-stack">
          <FocusFatigueGauge focusState={focusState} focusScore={focusScore} fatigue={fatigue} />
          <ContactQuality contact={contact} channelNames={channelNames} />
        </div>
      </div>

      <RollingSpectrogram signals={signals} />

      <BandPowerChart channelBands={channelBands} />

      <div className="nl-grid-2">
        <ConnectivityArc signals={signals} />
        <div className="nl-stack">
          <SignalPipelinePanel health={streamHealth} history={streamHealthHistory} pipeline={frames.eeg?.pipeline} />
          <ImpedancePanel impedance={impedance} />
        </div>
      </div>

      <CalibrationPanel liveBands={meditation.bands} />
    </div>
  )
}
