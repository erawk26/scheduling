/**
 * Integration tests for POST /api/book/confirm endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/email/jwt', () => ({
  verifyBookingToken: vi.fn().mockResolvedValue(null),
}))

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

import { verifyBookingToken } from '@/lib/email/jwt'
import { writeFile, mkdir } from 'fs/promises'
import type { Route } from '@/routes/api/book/confirm'

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

describe('POST /api/book/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset implementations to default
    ;(writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it('returns 400 when request body is invalid JSON', async () => {
    const handler = await getHandler()
    const invalidJsonRequest = new Request('http://localhost:3000/api/book/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })

    const response = await handler({ request: invalidJsonRequest })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/Invalid request body/i)
  })

  it('returns 400 when token is missing', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest({}) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Invalid request body')
  })

  it('returns 400 when token is empty string', async () => {
    const handler = await getHandler()
    const response = await handler({ request: buildRequest({ token: '' }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Invalid request body')
  })

  it('returns 400 when neither selectedSlot nor declineReason provided', async () => {
    const handler = await getHandler()

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId: 'appt-123', clientId: 'client-123' },
      expired: false,
    })

    const response = await handler({ request: buildRequest({ token: 'valid-token' }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Must provide selectedSlot or declineReason')
  })

  it('returns 400 when token verification fails (invalid token)', async () => {
    const handler = await getHandler()

    vi.mocked(verifyBookingToken).mockResolvedValueOnce(null)

    const response = await handler({ request: buildRequest({ token: 'invalid-token' }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Invalid token')
  })

  it('returns 400 when token is expired', async () => {
    const handler = await getHandler()

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId: 'appt-123', clientId: 'client-123' },
      expired: true,
    })

    const response = await handler({ request: buildRequest({ token: 'expired-token' }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Booking link has expired')
  })

  it('returns 200 with redirect when booking confirmed with selectedSlot', async () => {
    const handler = await getHandler()
    const appointmentId = 'appt-123'
    const clientId = 'client-123'
    const selectedSlot = '2026-03-30T10:00:00'

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId, clientId },
      expired: false,
    })

    const response = await handler({
      request: buildRequest({ token: 'valid-token', selectedSlot }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; redirectTo: string }
    expect(json.success).toBe(true)
    expect(json.redirectTo).toBe(`/book/valid-token/confirmed`)

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(appointmentId),
      expect.stringContaining('confirmed'),
      'utf8'
    )
  })

  it('writes booking confirmation file with correct data', async () => {
    const handler = await getHandler()
    const appointmentId = 'appt-456'
    const clientId = 'client-789'
    const selectedSlot = '2026-04-01T14:30:00'

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId, clientId },
      expired: false,
    })

    ;(writeFile as ReturnType<typeof vi.fn>).mockClear()

    const response = await handler({
      request: buildRequest({ token: 'token-xyz', selectedSlot }),
    })

    expect(response.status).toBe(200)

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(appointmentId),
      expect.stringContaining('confirmed'),
      'utf8'
    )

    const writtenArg = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    const writtenData = JSON.parse(writtenArg)
    expect(writtenData.clientId).toBe(clientId)
    expect(writtenData.selectedSlot).toBe(selectedSlot)
    expect(writtenData.status).toBe('confirmed')
    expect(writtenData.confirmedAt).toBeDefined()
  })

  it('returns 200 with declined status when booking declined', async () => {
    const handler = await getHandler()
    const appointmentId = 'appt-789'
    const clientId = 'client-321'
    const declineReason = 'Not available at that time'

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId, clientId },
      expired: false,
    })

    const response = await handler({
      request: buildRequest({ token: 'decline-token', declineReason }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; status: string }
    expect(json.success).toBe(true)
    expect(json.status).toBe('declined')

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(appointmentId),
      expect.stringContaining('declined'),
      'utf8'
    )
  })

  it('writes booking decline file with correct data', async () => {
    const handler = await getHandler()
    const appointmentId = 'appt-999'
    const clientId = 'client-888'
    const declineReason = 'Service not needed'

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId, clientId },
      expired: false,
    })

    ;(writeFile as ReturnType<typeof vi.fn>).mockClear()

    const response = await handler({
      request: buildRequest({ token: 'token-decline', declineReason }),
    })

    expect(response.status).toBe(200)

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(appointmentId),
      expect.stringContaining('declined'),
      'utf8'
    )

    const writtenArg = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    const writtenData = JSON.parse(writtenArg)
    expect(writtenData.clientId).toBe(clientId)
    expect(writtenData.declineReason).toBe(declineReason)
    expect(writtenData.status).toBe('declined')
    expect(writtenData.declinedAt).toBeDefined()
  })

  it('handles file write errors gracefully', async () => {
    const handler = await getHandler()

    vi.mocked(verifyBookingToken).mockResolvedValueOnce({
      payload: { appointmentId: 'appt-err', clientId: 'client-err' },
      expired: false,
    })

    ;(writeFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Disk full'))

    const response = await handler({
      request: buildRequest({ token: 'token', selectedSlot: '2026-03-30T10:00:00' }),
    })

    expect(response.status).toBe(500)
  })
})
