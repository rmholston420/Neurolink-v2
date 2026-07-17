import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNeurolinkStore } from '../hooks/useNeurolinkStore'

const KEY = 'neurolink.signal_mode'

// The shared setup mock omits Response.text(); the apiClient reads the body via
// r.text(), so provide a full Response-like that echoes the posted mode back.
function installModeFetch() {
  global.fetch = vi.fn(async (input: any, init?: any) => {
    const raw = typeof input === 'string' ? input : (input?.url ?? String(input))
    const url = raw.replace(/^https?:\/\/[^/]+/, '')
    let body: unknown = {}
    if (url.includes('/stream/mode')) {
      const posted = init?.body ? JSON.parse(init.body) : {}
      body = { mode: posted.mode ?? 'meditation' }
    }
    const text = JSON.stringify(body)
    return { ok: true, status: 200, statusText: 'OK', text: async () => text, json: async () => body } as any
  }) as any
}

describe('useNeurolinkStore signal mode', () => {
  beforeEach(() => {
    localStorage.clear()
    installModeFetch()
  })

  it('defaults to meditation when nothing is persisted', () => {
    const { result } = renderHook(() => useNeurolinkStore())
    expect(result.current.signalMode).toBe('meditation')
  })

  it('setSignalMode updates state, persists to localStorage, and posts to the API', async () => {
    const { result } = renderHook(() => useNeurolinkStore())
    // Let the mount-time mode sync (default meditation) resolve first so it
    // doesn't race our explicit selection below.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.setSignalMode('raw')
    })
    expect(result.current.signalMode).toBe('raw')
    expect(localStorage.getItem(KEY)).toBe('raw')
    const calledMode = (global.fetch as any).mock.calls.some(([url, init]: [any, any]) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      return u.includes('/stream/mode') && init?.method === 'POST' && String(init?.body).includes('raw')
    })
    expect(calledMode).toBe(true)
  })

  it('restores the persisted mode across remounts', async () => {
    localStorage.setItem(KEY, 'notch')
    const { result } = renderHook(() => useNeurolinkStore())
    await waitFor(() => expect(result.current.signalMode).toBe('notch'))
  })
})
