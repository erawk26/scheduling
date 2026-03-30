/**
 * Integration tests for POST /api/geocode endpoint.
 *
 * Tests error responses: 400 (missing/invalid address, malformed JSON), 503 (missing API key), 500 (geocoding failure).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock geocode service and react-router
// ---------------------------------------------------------------------------

vi.mock('@/lib/graphhopper/client', () => ({
  geocode: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

// ---------------------------------------------------------------------------
// Import the handler AFTER mocks are wired
// ---------------------------------------------------------------------------

async function getHandler() {
  const mod = await import('../geocode.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/geocode', () => {
  const originalEnv = process.env.GRAPHHOPPER_API_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GRAPHHOPPER_API_KEY = originalEnv
    } else {
      delete process.env.GRAPHHOPPER_API_KEY
    }
  })

  // -------------------------------------------------------------------------
  // 400 — malformed JSON
  // -------------------------------------------------------------------------

  it('returns 400 when request body is malformed JSON', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const request = new Request('http://localhost:3000/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{{{',
    })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid|JSON|parse/i)
  })

  // -------------------------------------------------------------------------
  // 400 — missing address
  // -------------------------------------------------------------------------

  it('returns 400 when address field is missing', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({}), // no address
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/address.*required/i)
  })

  it('returns 400 when address is not a string', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ address: 12345 }), // address not a string
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/address.*required/i)
  })

  it('returns 400 when address is empty string', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ address: '' }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/address.*required/i)
  })

  // -------------------------------------------------------------------------
  // 503 — missing API key
  // -------------------------------------------------------------------------

  it('returns 503 when GRAPHHOPPER_API_KEY is not set', async () => {
    delete process.env.GRAPHHOPPER_API_KEY

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ address: '123 Main St, New York, NY' }),
    })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured|Geocoding.*configured/i)
  })

  // -------------------------------------------------------------------------
  // 404 — address not found
  // -------------------------------------------------------------------------

  it('returns 404 when address is not found', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const { geocode } = await import('@/lib/graphhopper/client')
    vi.mocked(geocode).mockResolvedValueOnce(null)

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ address: 'Nonexistent Place, Nowhere' }),
    })

    expect(response.status).toBe(404)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not found/i)
  })

  // -------------------------------------------------------------------------
  // 500 — geocoding failure (exception thrown)
  // -------------------------------------------------------------------------

  it('returns 500 when geocoding service throws an error', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const { geocode } = await import('@/lib/graphhopper/client')
    vi.mocked(geocode).mockRejectedValueOnce(new Error('Network timeout'))

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ address: '123 Main St, New York, NY' }),
    })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/failed/i)
  })
})
