/**
 * Integration tests for POST /api/schedule/suggest endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/schedule-intelligence/suggester', () => ({
  generateSuggestions: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

import { generateSuggestions } from '@/lib/schedule-intelligence/suggester'
import type { Route } from '@/routes/api/schedule/suggest'

async function getHandler() {
  const mod = await import('../suggest')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/schedule/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/schedule/suggest', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 400 when appointmentsByDate is missing', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest({}) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/appointmentsByDate is required/i)
  })

  it('returns 400 when appointmentsByDate is not an object', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest({ appointmentsByDate: 'not an object' }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/appointmentsByDate is required/i)
  })

  it('returns 200 with suggestions on success', async () => {
    const handler = await getHandler()

    const mockSuggestions = {
      byDate: {
        '2026-03-30': [
          {
            appointmentId: 'appt-1',
            currentStart: '2026-03-30T09:00:00',
            suggestedStart: '2026-03-30T09:30:00',
            reason: 'chain_buffer',
            confidence: 0.85,
            impact: { timeSavedMin: 15, distanceSavedMi: 2 },
          },
        ],
        '2026-03-31': [
          {
            appointmentId: 'appt-2',
            currentStart: '2026-03-31T14:00:00',
            suggestedStart: '2026-03-31T13:45:00',
            reason: 'efficiency_gap',
            confidence: 0.72,
            impact: { timeSavedMin: 15, distanceSavedMi: 3 },
          },
        ],
      },
      summary: {
        totalSuggestions: 2,
        avgConfidence: 0.785,
        potentialTimeSavedMin: 30,
        potentialDistanceSavedMi: 5,
      },
    }

    ;(generateSuggestions as ReturnType<typeof vi.fn>).mockReturnValue(mockSuggestions)

    const appointmentsByDate = {
      '2026-03-30': [
        {
          id: 'appt-1',
          clientId: 'client-1',
          serviceId: 'service-1',
          start: '2026-03-30T09:00:00',
          end: '2026-03-30T10:00:00',
          location_type: 'home',
          status: 'scheduled' as const,
        },
      ],
      '2026-03-31': [
        {
          id: 'appt-2',
          clientId: 'client-2',
          serviceId: 'service-2',
          start: '2026-03-31T14:00:00',
          end: '2026-03-31T15:00:00',
          location_type: 'home',
          status: 'scheduled' as const,
        },
      ],
    }

    const response = await handler({
      request: buildRequest({ appointmentsByDate }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')

    const json = (await response.json()) as typeof mockSuggestions
    expect(json).toEqual(mockSuggestions)

    expect(generateSuggestions).toHaveBeenCalledWith(
      expect.any(Map),
      undefined
    )
  })

  it('passes options to generateSuggestions when provided', async () => {
    const handler = await getHandler()

    ;(generateSuggestions as ReturnType<typeof vi.fn>).mockReturnValue({ byDate: {}, summary: { totalSuggestions: 0, avgConfidence: 0, potentialTimeSavedMin: 0, potentialDistanceSavedMi: 0 } })

    const appointmentsByDate = {
      '2026-03-30': [
        {
          id: 'appt-1',
          clientId: 'client-1',
          serviceId: 'service-1',
          start: '2026-03-30T09:00:00',
          end: '2026-03-30T10:00:00',
          location_type: 'home',
          status: 'scheduled' as const,
        },
      ],
    }

    const options = {
      minConfidence: 0.7,
      maxSuggestionsPerDay: 5,
    }

    const response = await handler({
      request: buildRequest({ appointmentsByDate, options }),
    })

    expect(response.status).toBe(200)
    expect(generateSuggestions).toHaveBeenCalledWith(
      expect.any(Map),
      options
    )
  })

  it('handles empty appointmentsByDate by returning empty suggestions', async () => {
    const handler = await getHandler()

    const emptySuggestions = {
      byDate: {},
      summary: { totalSuggestions: 0, avgConfidence: 0, potentialTimeSavedMin: 0, potentialDistanceSavedMi: 0 },
    }

    ;(generateSuggestions as ReturnType<typeof vi.fn>).mockReturnValue(emptySuggestions)

    const response = await handler({
      request: buildRequest({ appointmentsByDate: {} }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as typeof emptySuggestions
    expect(json.byDate).toEqual({})
    expect(json.summary.totalSuggestions).toBe(0)
  })

  it('returns 500 when generateSuggestions throws', async () => {
    const handler = await getHandler()

    ;(generateSuggestions as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Invalid appointment data')
    })

    const response = await handler({
      request: buildRequest({
        appointmentsByDate: {
          '2026-03-30': [
            {
              id: 'appt-invalid',
              clientId: 'client-1',
              serviceId: 'service-1',
              start: 'invalid-date',
              end: '2026-03-30T10:00:00',
              location_type: 'home',
              status: 'scheduled' as const,
            },
          ],
        },
      }),
    })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Invalid appointment data')
  })
})
