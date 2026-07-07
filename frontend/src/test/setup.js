import '@testing-library/jest-dom'

const originalFetch = global.fetch

function normalizeUrl(input) {
  const raw = typeof input === 'string' ? input : (input?.url ?? String(input))
  return raw.replace(/^https?:\/\/[^/]+/, '')
}

function okJson(data) {
  return {
    ok: true,
    json: async () => data,
  }
}

beforeEach(() => {
  global.fetch = vi.fn(async (input) => {
    const url = normalizeUrl(input)

    if (url.includes('/api/stream/recording')) {
      return okJson({
        recording: false,
        path: null,
      })
    }

    if (url.includes('/api/sessions/history/list')) {
      return okJson({
        status: 'ok',
        sessions: [],
      })
    }

    return okJson({})
  })
})

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})
