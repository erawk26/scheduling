/**
 * Integration tests for POST /api/routes/optimize endpoint.
 *
 * Tests error responses: 400, 429, 503 for various invalid inputs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router - must be hoisted before route module loads
// ---------------------------------------------------------------------------

const mockOptimizeRoute = vi.fn()
const mockCreditTracker = {
  canSpend: vi.fn(() => true),
  recordUsage: vi.fn(),
  getUsage: vi.fn(() => ({ date: '2026-03-29', used: 0, limit: 500 })),
  isWarning: vi.fn(() => false),
}

vi.mock('@/lib/graphhopper/client', () => ({
  optimizeRoute: mockOptimizeRoute,
  creditTracker: mockCreditTracker,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    // Extract server handlers from config and return them directly
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

// ---------------------------------------------------------------------------
// Import the handler AFTER mocks are wired
// ---------------------------------------------------------------------------

async function getHandler() {
  const mod = await import('../optimize.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown): Request {
  return new Request('http://localhost:3025/api/routes/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/routes/optimize', () => {
  const originalEnv = process.env.GRAPHHOPPER_API_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockOptimizeRoute.mockReset()
    mockCreditTracker.canSpend.mockReturnValue(true)
    mockCreditTracker.getUsage.mockReturnValue({ date: '2026-03-29', used: 0, limit: 500 })
  })

  // -------------------------------------------------------------------------
  // 400 — malformed JSON
  // -------------------------------------------------------------------------

  it('returns 400 when request body is malformed JSON', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()
    const request = new Request('http://localhost:3025/api/routes/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{{{',
    })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid|JSON|failed to parse/i)
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GRAPHHOPPER_API_KEY = originalEnv
    } else {
      delete process.env.GRAPHHOPPER_API_KEY
    }
  })

  // -------------------------------------------------------------------------
  // 400 — insufficient stops
  // -------------------------------------------------------------------------

  it('returns 400 when stops array has < 2 locations', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    const handler = await getHandler()

    // Single stop
    const response1 = await handler({
      request: buildRequest({
        stops: [
          { id: 'a', lat: 40.7128, lon: -74.006, duration_minutes: 30 },
        ],
      }),
    })
    expect(response1.status).toBe(400)
    const json1 = (await response1.json()) as { error: string }
    expect(json1.error).toMatch(/at least 2 stops|2 locations/i)

    // Empty stops
    const response2 = await handler({
      request: buildRequest({ stops: [] }),
    })
    expect(response2.status).toBe(400)
    const json2 = (await response2.json()) as { error: string }
    expect(json2.error).toMatch(/at least 2 stops/i)
  })

  // -------------------------------------------------------------------------
  // 503 — missing API key
  // -------------------------------------------------------------------------

  it('returns 503 when GRAPHHOPPER_API_KEY is not set', async () => {
    delete process.env.GRAPHHOPPER_API_KEY

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'a', lat: 40.7128, lon: -74.006, duration_minutes: 30 },
          { id: 'b', lat: 40.758, lon: -73.985, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured|Route optimization not configured/i)
  })

  // -------------------------------------------------------------------------
  // 429 — rate limit / credit limit
  // -------------------------------------------------------------------------

  it('returns 429 when daily credit limit is exceeded', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    mockCreditTracker.canSpend.mockReturnValue(false) // credit limit reached
    mockCreditTracker.getUsage.mockReturnValue({ date: '2026-03-29', used: 475, limit: 500 })

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'a', lat: 40.7128, lon: -74.006, duration_minutes: 30 },
          { id: 'b', lat: 40.758, lon: -73.985, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(429)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/credit limit|daily credit/i)
  })

  // -------------------------------------------------------------------------
  // 500 — optimization failure
  // -------------------------------------------------------------------------

  it('returns 500 when GraphHopper API call fails', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    mockOptimizeRoute.mockRejectedValueOnce(new Error('GraphHopper VRP error: Service temporarily unavailable'))

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'a', lat: 40.7128, lon: -74.006, duration_minutes: 30 },
          { id: 'b', lat: 40.758, lon: -73.985, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // 404 — no route found
  // -------------------------------------------------------------------------

  it('returns 404 when no route solution is found', async () => {
    process.env.GRAPHHOPPER_API_KEY = 'test-key'

    mockOptimizeRoute.mockResolvedValue({
      solution: { routes: [], no_unassigned: 0, distance: 0, transport_time: 0, completion_time: 0 },
      status: 'ok',
      processing_time: 1.0,
    })

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({
        stops: [
          { id: 'a', lat: 40.7128, lon: -74.006, duration_minutes: 30 },
          { id: 'b', lat: 40.758, lon: -73.985, duration_minutes: 30 },
        ],
      }),
    })

    expect(response.status).toBe(404)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/no route found/i)
  })
})
