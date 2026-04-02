/**
 * Integration tests for GET /api/weather/forecast endpoint.
 *
 * Tests error responses: 400 (missing/invalid params), 503 (missing API key).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock weather service and react-router
// ---------------------------------------------------------------------------

vi.mock('@/lib/weather/service', () => ({
  fetchWeatherForecast: vi.fn(() => null),
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
  const mod = await import('../forecast.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { GET: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.GET
}

function buildRequest(lat: number, lon: number): Request {
  const url = `http://localhost:3025/api/weather/forecast?lat=${lat}&lon=${lon}`
  return new Request(url, { method: 'GET' })
}

function buildRequestMissing(): Request {
  return new Request('http://localhost:3025/api/weather/forecast', { method: 'GET' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/weather/forecast', () => {
  const originalEnv = process.env.TOMORROW_IO_API_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TOMORROW_IO_API_KEY = originalEnv
    } else {
      delete process.env.TOMORROW_IO_API_KEY
    }
  })

  // -------------------------------------------------------------------------
  // 400 — missing parameters
  // -------------------------------------------------------------------------

  it('returns 400 when lat parameter is missing', async () => {
    delete process.env.TOMORROW_IO_API_KEY

    const handler = await getHandler()
    const response = await handler({ request: buildRequestMissing() })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/missing|required/i)
  })

  it('returns 400 when only lat is provided (missing lon)', async () => {
    process.env.TOMORROW_IO_API_KEY = 'test-key'

    const handler = await getHandler()
    const url = 'http://localhost:3025/api/weather/forecast?lat=40.7128'
    const request = new Request(url, { method: 'GET' })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/missing|required/i)
  })

  // -------------------------------------------------------------------------
  // 400 — invalid coordinates
  // -------------------------------------------------------------------------

  it('returns 400 when latitude is out of range', async () => {
    process.env.TOMORROW_IO_API_KEY = 'test-key'

    const handler = await getHandler()

    // Latitude > 90
    const response1 = await handler({ request: buildRequest(91.0, -74.006) })
    expect(response1.status).toBe(400)
    const json1 = (await response1.json()) as { error: string }
    expect(json1.error).toMatch(/invalid/i)

    // Latitude < -90
    const response2 = await handler({ request: buildRequest(-91.0, -74.006) })
    expect(response2.status).toBe(400)
    const json2 = (await response2.json()) as { error: string }
    expect(json2.error).toMatch(/invalid/i)
  })

  it('returns 400 when longitude is out of range', async () => {
    process.env.TOMORROW_IO_API_KEY = 'test-key'

    const handler = await getHandler()

    // Longitude > 180
    const response1 = await handler({ request: buildRequest(40.7128, 181.0) })
    expect(response1.status).toBe(400)
    const json1 = (await response1.json()) as { error: string }
    expect(json1.error).toMatch(/invalid/i)

    // Longitude < -180
    const response2 = await handler({ request: buildRequest(40.7128, -181.0) })
    expect(response2.status).toBe(400)
    const json2 = (await response2.json()) as { error: string }
    expect(json2.error).toMatch(/invalid/i)
  })

  it('returns 400 when coordinates are non-numeric', async () => {
    process.env.TOMORROW_IO_API_KEY = 'test-key'

    const handler = await getHandler()
    const url = 'http://localhost:3025/api/weather/forecast?lat=invalid&lon=-74.006'
    const request = new Request(url, { method: 'GET' })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid/i)
  })

  // -------------------------------------------------------------------------
  // 503 — missing API key
  // -------------------------------------------------------------------------

  it('returns 503 when TOMORROW_IO_API_KEY is not set', async () => {
    delete process.env.TOMORROW_IO_API_KEY

    const handler = await getHandler()
    const response = await handler({ request: buildRequest(40.7128, -74.006) })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured|weather.*unavailable/i)
  })

  // -------------------------------------------------------------------------
  // 503 — weather data unavailable
  // -------------------------------------------------------------------------

  it('returns 503 when weather service returns no data', async () => {
    process.env.TOMORROW_IO_API_KEY = 'test-key'

    const { fetchWeatherForecast } = await import('@/lib/weather/service')
    vi.mocked(fetchWeatherForecast).mockResolvedValueOnce(null)

    const handler = await getHandler()
    const response = await handler({ request: buildRequest(40.7128, -74.006) })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/unavailable|no.*data/i)
  })
})
