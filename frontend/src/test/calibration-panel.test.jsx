import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { CalibrationPanel } from '../components/signal/CalibrationPanel'

const LIVE = { delta: 0.2, theta: 0.15, alpha: 0.4, beta: 0.2, gamma: 0.05 }

vi.mock('../lib/apiClient', () => ({
  meditationApi: { latestCalibration: vi.fn() },
}))

import { meditationApi } from '../lib/apiClient'

describe('CalibrationPanel', () => {
  it('shows a no-baseline prompt when none is stored', async () => {
    meditationApi.latestCalibration.mockResolvedValue({})
    render(<CalibrationPanel liveBands={LIVE} />)
    expect(screen.getByText('Calibration')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/No baseline captured yet/i)).toBeInTheDocument())
  })

  it('renders live vs baseline rows once a baseline loads', async () => {
    meditationApi.latestCalibration.mockResolvedValue({
      label: 'Morning sit',
      alpha_base: 0.3,
      theta_base: 0.1,
      beta_base: 0.15,
      delta_base: 0.25,
      gamma_base: 0.04,
    })
    render(<CalibrationPanel liveBands={LIVE} />)
    await waitFor(() => expect(screen.getByText(/Baseline: Morning sit/i)).toBeInTheDocument())
    expect(screen.getByText(/alpha/)).toBeInTheDocument()
  })
})
