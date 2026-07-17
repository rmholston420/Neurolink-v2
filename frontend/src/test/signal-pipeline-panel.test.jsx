import React from 'react'
import { render, screen } from '@testing-library/react'
import { SignalPipelinePanel } from '../components/signal/SignalPipelinePanel'

const HEALTH = {
  frames_total: 100,
  frames_clean: 90,
  frames_rejected: 10,
  packet_loss_pct: 4.2,
  last_frame_ts: 0,
  avg_tick_ms: 12.5,
}

describe('SignalPipelinePanel', () => {
  it('renders health counters', () => {
    render(<SignalPipelinePanel health={HEALTH} history={[]} pipeline={undefined} />)
    expect(screen.getByText('Signal pipeline')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('4.2%')).toBeInTheDocument()
  })

  it('flags a rejected frame from the pipeline payload', () => {
    render(<SignalPipelinePanel health={HEALTH} history={[1, 2, 3]} pipeline={{ artifact_rejected: true, artifact_reasons: ['motion'] }} />)
    expect(screen.getByText('frame rejected')).toBeInTheDocument()
    expect(screen.getByText(/motion/)).toBeInTheDocument()
  })
})
