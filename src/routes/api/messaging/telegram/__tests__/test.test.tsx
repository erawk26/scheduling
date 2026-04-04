/**
 * Tests for POST /api/messaging/telegram/test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the sendTelegramMessage function
vi.mock('@/lib/messaging/adapters', () => ({
  sendTelegramMessage: vi.fn(),
}))

import { sendTelegramMessage } from '@/lib/messaging/adapters'

// Mock tanstack router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

async function getHandler() {
  const mod = await import('../test')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  const url = 'http://localhost:3025/api/messaging/telegram/test'
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/messaging/telegram/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env var
    delete process.env.TELEGRAM_BOT_TOKEN
  })

  it('returns 400 if request body is invalid JSON', async () => {
    const handler = await getHandler()
    const request = new Request('http://localhost:3025/api/messaging/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })

    const response = await handler({ request })

    expect(response.status).toBe(400)
  })

  it('returns 400 if chatId is missing', async () => {
    const handler = await getHandler()
    const request = buildRequest({})

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const data = await response.json() as { success: boolean; error?: string }
    expect(data.success).toBe(false)
    // Zod returns either "Required" or custom message depending on exact failure
    expect(['Chat ID is required', 'Required']).toContain(data.error)
  })

  it('returns 503 if TELEGRAM_BOT_TOKEN is not configured', async () => {
    const handler = await getHandler()
    const request = buildRequest({ chatId: '123456' })

    const response = await handler({ request })

    expect(response.status).toBe(503)
    const data = await response.json() as { success: boolean; error?: string }
    expect(data.success).toBe(false)
    expect(data.error).toBe('Telegram bot token not configured on server')
  })

  it('sends test message successfully when token is configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-123'
    const mockSend = vi.mocked(sendTelegramMessage)
    mockSend.mockResolvedValue(true)

    const handler = await getHandler()
    const request = buildRequest({ chatId: '123456789' })

    const response = await handler({ request })

    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean; message?: string }
    expect(data.success).toBe(true)
    expect(data.message).toBe('Test message sent successfully')

    expect(mockSend).toHaveBeenCalledWith(
      'test-token-123',
      '123456789',
      expect.stringContaining('🟢 Test message from KE Agenda')
    )
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('handles send failure gracefully', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-123'
    const mockSend = vi.mocked(sendTelegramMessage)
    mockSend.mockResolvedValue(false)

    const handler = await getHandler()
    const request = buildRequest({ chatId: '123456789' })

    const response = await handler({ request })

    expect(response.status).toBe(502)
    const data = await response.json() as { success: boolean; error?: string }
    expect(data.success).toBe(false)
    expect(data.error).toBe('Failed to send test message. Check bot token and chat ID.')
  })
})
