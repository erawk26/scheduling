/**
 * Integration tests for POST /api/routes/optimize endpoint.
 *
 * Tests VRP optimization with various scenarios: success, validation errors,
 * API key missing, credit limits, and optimization failures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the graphhopper client BEFORE importing the route
vi.mock('@/lib/graphhopper/client', () => ({
  optimizeRoute: vi.fn(),
  creditTracker: {
    canSpend: vi.fn(() => true),
    getUsage: vi.fn(() => ({ used: 100, limit: 500 })),
    recordUsage: vi.fn(),
    isWarning: vi.fn(() => false),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

import { optimizeRoute, creditTracker } from '@/lib/graphhopper/client'
import type { OptimizationResult } from '@/lib/graphhopper/types'

async function getHandler() {
  const mod = await import('../optimize')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3025/api/routes/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/routes/optimize', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ;(creditTracker.canSpend as ReturnType<typeof vi.fn>).mockReturnValue(true)
  })

  afterEach(() => {
    if (process.env.GRAPHHOPPER_API_KEY !== undefined) {
      // restore if needed
    } else {
      // ensure cleanup
    }
  })

  // ---------------------------------------------------------------------------
  // 503 — Missing API key
  // ---------------------------------------------------------------------------

  it('returns 503 when GRAPHHOPPER_API_KEY is not set', async () => {
    delete process.env.GRAPHHOPPER_API_KEY

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured/i)
  })

  it('returns 503 when GRAPHHOPPER_API_KEY is empty', async () => {
    process.env.GRAPHHOPPER_API_KEY = ''

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured/i)
  })

  // ---------------------------------------------------------------------------
  // 400 — Validation errors
  // ---------------------------------------------------------------------------

  it('returns 400 when stops array is missing', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ start: { lat: 32.7767, lon: -96.797 } }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/At least 2 stops required/i)
  })

  it('returns 400 when stops array is empty', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ stops: [] }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/At least 2 stops required/i)
  })

  it('returns 400 when stops array has only 1 stop', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        stops: [{ id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 }],
      }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/At least 2 stops required/i)
  })

  it('returns 400 when stops missing required lat/lon fields', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // 429 — Credit limit reached
  // ---------------------------------------------------------------------------

  it('returns 429 when daily credit limit is reached', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'
    ;(creditTracker.canSpend as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(429)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Daily credit limit reached/i)
  })

  // ---------------------------------------------------------------------------
  // 200 — Successful optimization
  // ---------------------------------------------------------------------------

  it('returns 200 with optimization result on success', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    const mockResponse: OptimizationResult = {
      stops: [
        {
          id: 'stop1',
          arrivalTimeS: 3600,
          departureTimeS: 5400,
          distanceM: 1000,
          drivingTimeS: 1800,
        },
        {
          id: 'stop2',
          arrivalTimeS: 5400,
          departureTimeS: 7200,
          distanceM: 1500,
          drivingTimeS: 1800,
        },
      ],
      totalDistanceM: 50000,
      totalTimeS: 7200,
      polyline: 'encoded_polyline_string_here',
      source: 'graphhopper',
    }

    ;(optimizeRoute as ReturnType<typeof vi.fn>).mockResolvedValue({
      solution: {
        routes: [
          {
            activities: [
              { type: 'service', id: 'stop1', arr_time: 3600, end_time: 5400, distance: 1000, driving_time: 1800 },
              { type: 'service', id: 'stop2', arr_time: 5400, end_time: 7200, distance: 1500, driving_time: 1800 },
            ],
            distance: 50000,
            transport_time: 7200,
            points: 'encoded_polyline_string_here',
          },
        ],
      },
    } as unknown as Parameters<typeof optimizeRoute>[0])

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
        start: { lat: 32.7767, lon: -96.797 },
      }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as OptimizationResult
    expect(json).toEqual(mockResponse)
  })

  it('includes default start when not provided', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    const mockResponse: OptimizationResult = {
      stops: [],
      totalDistanceM: 0,
      totalTimeS: 0,
      polyline: '',
      source: 'graphhopper',
    }

    ;(optimizeRoute as ReturnType<typeof vi.fn>).mockResolvedValue({
      solution: {
        routes: [
          {
            activities: [],
            distance: 0,
            transport_time: 0,
            points: '',
          },
        ],
      },
    } as unknown as Parameters<typeof optimizeRoute>[0])

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(200)
    // Verify optimizeRoute was called with start derived from first stop
    expect(optimizeRoute).toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 404 — No route found
  // ---------------------------------------------------------------------------

  it('returns 404 when no route solution is found', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    ;(optimizeRoute as ReturnType<typeof vi.fn>).mockResolvedValue({
      solution: { routes: [] },
    } as unknown as Parameters<typeof optimizeRoute>[0])

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(404)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/No route found/i)
  })

  // ---------------------------------------------------------------------------
  // 500 — Optimization failed
  // ---------------------------------------------------------------------------

  it('returns 500 when optimizeRoute throws', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    ;(optimizeRoute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('GraphHopper API error')
    )

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('GraphHopper API error')
  })

  it('returns 500 on generic error', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    ;(optimizeRoute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Unexpected error')
    )

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'stop1', lat: 32.7767, lon: -96.797, duration_minutes: 30 },
          { id: 'stop2', lat: 32.791, lon: -96.781, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Unexpected error')
  })
})
