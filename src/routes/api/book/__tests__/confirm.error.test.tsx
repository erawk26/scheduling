/**
 * Integration tests for POST /api/book/confirm endpoint.
 *
 * Tests error responses: 400 for JWT validation failures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock JWT verify and react-router
// ---------------------------------------------------------------------------

vi.mock('@/lib/email/jwt', () => ({
  verifyBookingToken: vi.fn(),
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
  const mod = await import('../confirm.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/book/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/book/confirm', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 400 — missing token
  // -------------------------------------------------------------------------

  it('returns 400 when token is missing (empty object)', async () => {
    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({}), // no token at all - Zod validation fails
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid|request body/i)
  })

  it('returns 400 when token is empty string', async () => {
    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({ token: '' }), // empty string fails z.string().min(1)
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid|request body/i)
  })

  // -------------------------------------------------------------------------
  // 400 — invalid token
  // -------------------------------------------------------------------------

  it('returns 400 when token is invalid', async () => {
    const { verifyBookingToken } = await import('@/lib/email/jwt')
    vi.mocked(verifyBookingToken).mockResolvedValueOnce(null) // null = invalid token

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({ token: 'invalid-token-123' }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid token/i)
  })

  // -------------------------------------------------------------------------
  // 400 — expired token
  // -------------------------------------------------------------------------

  it('returns 400 when token is expired', async () => {
    const { verifyBookingToken } = await import('@/lib/email/jwt')
    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: {
        appointmentId: 'appt-123',
        clientId: 'client-123',
        clientName: 'Test Client',
        serviceName: 'Grooming',
        businessName: 'Test Business',
        slots: [{ label: 'Mon 10am', value: '2026-03-30T10:00' }],
        deadline: '2026-03-29T23:59:59Z',
      },
      expired: true,
    })

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({ token: 'expired-token-123' }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/expired/i)
  })

  // -------------------------------------------------------------------------
  // 400 — missing selectedSlot and declineReason
  // -------------------------------------------------------------------------

  it('returns 400 when neither selectedSlot nor declineReason is provided', async () => {
    const { verifyBookingToken } = await import('@/lib/email/jwt')
    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: {
        appointmentId: 'appt-123',
        clientId: 'client-123',
        clientName: 'Test Client',
        serviceName: 'Grooming',
        businessName: 'Test Business',
        slots: [{ label: 'Mon 10am', value: '2026-03-30T10:00' }],
        deadline: '2026-03-29T23:59:59Z',
      },
      expired: false,
    })

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({ token: 'valid-token-123' }), // token valid but no action
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/selectedSlot|declineReason|must provide/i)
  })

  // -------------------------------------------------------------------------
  // 200 — successful confirmation
  // -------------------------------------------------------------------------

  it('returns 200 when booking confirmed with selectedSlot', async () => {
    const { verifyBookingToken } = await import('@/lib/email/jwt')
    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: {
        appointmentId: 'appt-123',
        clientId: 'client-123',
        clientName: 'Test Client',
        serviceName: 'Grooming',
        businessName: 'Test Business',
        slots: [{ label: 'Mon 10am', value: '2026-03-30T10:00' }],
        deadline: '2026-03-29T23:59:59Z',
      },
      expired: false,
    })

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({ token: 'valid-token-123', selectedSlot: '2026-03-30T10:00' }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; redirectTo?: string }
    expect(json.success).toBe(true)
    expect(json.redirectTo).toContain('/book/')
  })

  // -------------------------------------------------------------------------
  // 200 — successful decline
  // -------------------------------------------------------------------------

  it('returns 200 when booking declined', async () => {
    const { verifyBookingToken } = await import('@/lib/email/jwt')
    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: {
        appointmentId: 'appt-123',
        clientId: 'client-123',
        clientName: 'Test Client',
        serviceName: 'Grooming',
        businessName: 'Test Business',
        slots: [{ label: 'Mon 10am', value: '2026-03-30T10:00' }],
        deadline: '2026-03-29T23:59:59Z',
      },
      expired: false,
    })

    const handler = await getHandler()

    const response = await handler({
      request: buildRequest({ token: 'valid-token-123', declineReason: 'Not available' }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; status?: string }
    expect(json.success).toBe(true)
    expect(json.status).toBe('declined')
  })
})
