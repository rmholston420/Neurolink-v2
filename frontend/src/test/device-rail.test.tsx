import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DeviceRail } from '../components/shell/DeviceRail'
import type { NeurolinkStore } from '../hooks/useNeurolinkStore'

function makeStore(overrides: Partial<NeurolinkStore> = {}): NeurolinkStore {
  return {
    deviceStatus: { has_board: false, is_streaming: false },
    streamHealth: null,
    wsStatus: 'closed',
    battery: null,
    bandQuality: {},
    channelNames: [],
    scan: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    scanning: false,
    connecting: false,
    scanResults: [],
    selectedDevice: null,
    setSelectedDevice: vi.fn(),
    lastPaired: null,
    deviceError: null,
    ...overrides,
  } as unknown as NeurolinkStore
}

const connectBtn = () => screen.getByRole('button', { name: /Connect|Reconnect/ })
const disconnectBtn = () => screen.getByRole('button', { name: 'Disconnect device' })

describe('DeviceRail connect/disconnect states', () => {
  it('disables Connect with no target and disables Disconnect when idle', () => {
    render(<DeviceRail store={makeStore()} />)
    expect(connectBtn()).toBeDisabled()
    expect(disconnectBtn()).toBeDisabled()
  })

  it('enables Connect when a scan result is selected', () => {
    const store = makeStore({
      scanResults: [{ name: 'Athena-234A', address: '00:55:DA:BA:23:4A' }] as any,
      selectedDevice: { name: 'Athena-234A', address: '00:55:DA:BA:23:4A' } as any,
    })
    render(<DeviceRail store={store} />)
    expect(connectBtn()).not.toBeDisabled()
  })

  it('enables Connect from a last-paired device with no scan', () => {
    const store = makeStore({
      lastPaired: { ble_address: '00:55:DA:BA:23:4A', display_name: 'Athena-234A' } as any,
    })
    render(<DeviceRail store={store} />)
    expect(screen.getByRole('button', { name: /Reconnect to Athena-234A/ })).not.toBeDisabled()
  })

  it('enables Disconnect when the board is connected', () => {
    render(<DeviceRail store={makeStore({ deviceStatus: { has_board: true, is_streaming: false } as any })} />)
    expect(disconnectBtn()).not.toBeDisabled()
  })

  it('surfaces a device error', () => {
    render(<DeviceRail store={makeStore({ deviceError: 'Scan failed' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Scan failed')
  })
})
