/**
 * Integration tests for POST /api/schedule/suggest endpoint.
 *
 * Tests error responses: 400 (missing/invalid appointmentsByDate).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock schedule intelligence and react-router
// ---------------------------------------------------------------------------

vi.mock('@/lib/schedule-intelligence/suggester', () => ({
  generateSuggestions: vi.fn(() =>
    new Map([['2026-03-30', []], ['2026-03-31', []]])
  ),
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
  const mod = await import('../suggest.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3025/api/schedule/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/schedule/suggest', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 400 — malformed JSON
  // -------------------------------------------------------------------------

  it('returns 400 when request body is malformed JSON', async () => {
    const handler = await getHandler()
    const request = new Request('http://localhost:3025/api/schedule/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{{{',
    })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid|JSON|failed to parse/i)
  })

  // -------------------------------------------------------------------------
  // 400 — missing appointmentsByDate
  // -------------------------------------------------------------------------

  it('returns 400 when appointmentsByDate is missing', async () => {
    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({}), // no appointmentsByDate
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/appointmentsByDate.*required/i)
  })

  it('returns 400 when appointmentsByDate is not an object', async () => {
    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ appointmentsByDate: 'not an object' }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    // The route checks: if (!body.appointmentsByDate || typeof body.appointmentsByDate !== 'object')
    expect(json.error).toMatch(/appointmentsByDate is required/i)
  })
})
