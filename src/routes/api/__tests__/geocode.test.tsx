/**
 * Integration tests for POST /api/geocode endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

import { geocode } from '@/lib/graphhopper/client'
import type { Route } from '@/routes/api/geocode'

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

describe('POST /api/geocode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (process.env.GRAPHHOPPER_API_KEY !== undefined) {
    } else {
      delete process.env.GRAPHHOPPER_API_KEY
    }
  })

  it('returns 503 when GRAPHHOPPER_API_KEY is not set', async () => {
    delete process.env.GRAPHHOPPER_API_KEY

    const handler = await getHandler()
    const response = await handler({ request: buildRequest({ address: '123 Main St' }) })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Geocoding not configured/i)
  })

  it('returns 503 when GRAPHHOPPER_API_KEY is empty', async () => {
    process.env.GRAPHHOPPER_API_KEY = ''

    const handler = await getHandler()
    const response = await handler({ request: buildRequest({ address: '123 Main St' }) })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Geocoding not configured/i)
  })

  it('returns 400 when address is missing', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({ request: buildRequest({}) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Address is required/i)
  })

  it('returns 400 when address is not a string', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({ request: buildRequest({ address: 123 }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Address is required/i)
  })

  it('returns 400 when address is empty string', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({ request: buildRequest({ address: '' }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Address is required/i)
  })

  it('returns 404 when address is not found', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    ;(geocode as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await handler({ request: buildRequest({ address: 'Nonexistent Place, Nowhere' }) })

    expect(response.status).toBe(404)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Address not found/i)
  })

  it('returns 200 with geocoding result on success', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    const mockResult = {
      lat: 32.7767,
      lon: -96.797,
      formatted_address: '123 Main St, Anytown, TX 75001',
      city: 'Anytown',
      state: 'TX',
      postcode: '75001',
      country: 'USA',
    }

    ;(geocode as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult)

    const response = await handler({ request: buildRequest({ address: '123 Main St, Anytown, TX' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')

    const json = (await response.json()) as typeof mockResult
    expect(json).toEqual(mockResult)

    expect(geocode).toHaveBeenCalledWith('123 Main St, Anytown, TX')
  })

  it('returns 500 when geocode throws', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    ;(geocode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('GraphHopper API error')
    )

    const response = await handler({ request: buildRequest({ address: '123 Main St' }) })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/failed/i)
  })

  it('returns 500 on fetch error', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    ;(geocode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    )

    const response = await handler({ request: buildRequest({ address: '123 Main St' }) })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/failed/i)
  })
})
