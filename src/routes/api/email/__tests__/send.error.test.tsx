/**
 * Integration tests for POST /api/email/send endpoint.
 *
 * Tests error responses: 500 (missing RESEND_API_KEY), 400 (malformed JSON, invalid email, unknown template), 502 (send failure).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock email service and react-router
// ---------------------------------------------------------------------------

vi.mock('@/lib/email/resend-client', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/email/templates', () => ({
  bookingInvitationTemplate: vi.fn((data) => `Invitation: ${data.businessName}`),
  bookingConfirmationTemplate: vi.fn((data) => `Confirmation: ${data.appointmentId}`),
  bookingReminderTemplate: vi.fn((data) => `Reminder: ${data.appointmentId}`),
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
  const mod = await import('../../email/send.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/email/send', () => {
  const originalEnv = process.env.RESEND_API_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RESEND_API_KEY = originalEnv
    } else {
      delete process.env.RESEND_API_KEY
    }
  })

  // -------------------------------------------------------------------------
  // 500 — missing API key
  // -------------------------------------------------------------------------

  it('returns 500 when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY

    const handler = await getHandler()
    const request = buildRequest({
      to: 'test@example.com',
      templateName: 'booking-invitation',
      templateData: { businessName: 'Test', serviceName: 'Grooming' },
    })

    const response = await handler({ request })

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured|RESEND_API_KEY/i)
  })

  // -------------------------------------------------------------------------
  // 400 — malformed JSON
  // -------------------------------------------------------------------------

  it('returns 400 when request body is malformed JSON', async () => {
    process.env.RESEND_API_KEY = 'test-key'

    const handler = await getHandler()
    const request = new Request('http://localhost:3000/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{{{',
    })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid JSON|Invalid/i)
  })

  // -------------------------------------------------------------------------
  // 400 — invalid email address
  // -------------------------------------------------------------------------

  it('returns 400 when recipient email is invalid', async () => {
    process.env.RESEND_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        to: 'invalid-email',
        templateName: 'booking-invitation',
        templateData: { businessName: 'Test', serviceName: 'Grooming' },
      }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/email/i)
  })

  // -------------------------------------------------------------------------
  // 400 — missing required fields
  // -------------------------------------------------------------------------

  it('returns 400 when to field is missing', async () => {
    process.env.RESEND_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        templateName: 'booking-invitation',
        templateData: { businessName: 'Test', serviceName: 'Grooming' },
      }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    // Zod validation error - any error message is acceptable, just check we got one
    expect(json.error).toBeDefined()
    expect(json.error.length).toBeGreaterThan(0)
  })

  it('returns 400 when templateName is missing', async () => {
    process.env.RESEND_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        to: 'test@example.com',
        templateData: { businessName: 'Test', serviceName: 'Grooming' },
      }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    // Zod validation error - any error message is acceptable
    expect(json.error).toBeDefined()
  })

  it('returns 400 when templateName is not one of the allowed values', async () => {
    process.env.RESEND_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        to: 'test@example.com',
        templateName: 'invalid-template',
        templateData: { businessName: 'Test', serviceName: 'Grooming' },
      }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    // Zod enum error: "Invalid option: expected one of ..."
    expect(json.error).toMatch(/invalid option|expected one of/i)
  })

  // -------------------------------------------------------------------------
  // 502 — email send failure
  // -------------------------------------------------------------------------

  it('returns 502 when email sending fails', async () => {
    process.env.RESEND_API_KEY = 'test-key'

    const { sendEmail } = await import('@/lib/email/resend-client')
    vi.mocked(sendEmail).mockResolvedValueOnce({
      success: false,
      error: 'SMTP connection failed',
    })

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({
        to: 'test@example.com',
        templateName: 'booking-invitation',
        templateData: { businessName: 'Test', serviceName: 'Grooming' },
      }),
    })

    expect(response.status).toBe(502)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBeDefined()
  })
})
