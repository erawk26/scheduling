/**
 * Integration tests for GET /api/weather/forecast endpoint.
 *
 * Tests valid requests, missing/invalid parameters, and API errors.
 * Mocks fetchWeatherForecast to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WeatherForecast } from '@/lib/weather/types'

// Mock the weather service BEFORE importing the route
vi.mock('@/lib/weather/service', () => ({
  fetchWeatherForecast: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

import { fetchWeatherForecast } from '@/lib/weather/service'
import type { Route } from '@/routes/api/weather/forecast'

async function getHandler() {
  const mod = await import('../forecast')
  const route = mod.Route as unknown as {
    server: { handlers: { GET: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.GET
}

function buildRequest(queryString: string): Request {
  return new Request(`http://localhost:3025/api/weather/forecast?${queryString}`, {
    method: 'GET',
  })
}

describe('GET /api/weather/forecast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // 400 — Missing parameters
  // ---------------------------------------------------------------------------

  it('returns 400 when lat is missing', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lon=-96.797') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Missing required parameters/i)
  })

  it('returns 400 when lon is missing', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lat=32.7767') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Missing required parameters/i)
  })

  it('returns 400 when both params missing', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Missing required parameters/i)
  })

  // ---------------------------------------------------------------------------
  // 400 — Invalid coordinates
  // ---------------------------------------------------------------------------

  it('returns 400 when lat is invalid (NaN)', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lat=abc&lon=-96.797') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Invalid lat\/lon/i)
  })

  it('returns 400 when lat is out of range (>90)', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lat=100&lon=-96.797') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Invalid lat\/lon/i)
  })

  it('returns 400 when lat is out of range (<-90)', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lat=-100&lon=-96.797') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Invalid lat\/lon/i)
  })

  it('returns 400 when lon is out of range (>180)', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lat=32.7767&lon=200') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Invalid lat\/lon/i)
  })

  it('returns 400 when lon is out of range (<-180)', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest('lat=32.7767&lon=-200') })
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Invalid lat\/lon/i)
  })

  // ---------------------------------------------------------------------------
  // 200 — Valid request with forecasts
  // ---------------------------------------------------------------------------

  it('returns 200 with forecast data on valid request', async () => {
    const handler = await getHandler()

    const mockForecast: WeatherForecast = {
      date: '2026-03-29',
      temp_high_f: 72,
      temp_low_f: 55,
      temp_current_f: 65,
      feels_like_f: 63,
      humidity: 45,
      precip_probability: 10,
      wind_speed_mph: 8,
      wind_gust_mph: 14,
      weather_code: 1100,
      condition_label: 'Mostly Clear',
      condition_icon: 'Sun',
      is_outdoor_suitable: true,
      uv_index: 5,
    }

    ;(fetchWeatherForecast as ReturnType<typeof vi.fn>).mockResolvedValue([mockForecast])

    const response = await handler({ request: buildRequest('lat=32.7767&lon=-96.797') })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(response.headers.get('Cache-Control')).toContain('s-maxage')

    const json = (await response.json()) as { forecasts: WeatherForecast[]; location: { lat: number; lon: number } }
    expect(json.forecasts).toHaveLength(1)
    expect(json.forecasts[0]).toEqual(mockForecast)
    expect(json.location).toEqual({ lat: 32.7767, lon: -96.797 })

    expect(fetchWeatherForecast).toHaveBeenCalledWith(32.7767, -96.797)
  })

  // ---------------------------------------------------------------------------
  // 503 — Service unavailable
  // ---------------------------------------------------------------------------

  it('returns 503 when weather service returns null', async () => {
    const handler = await getHandler()

    ;(fetchWeatherForecast as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await handler({ request: buildRequest('lat=32.7767&lon=-96.797') })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/unavailable/i)
  })
})
