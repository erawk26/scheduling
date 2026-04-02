/**
 * Integration tests for POST /api/messaging/webhook endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock adapters module (static - no per-test customization needed)
vi.mock('@/lib/messaging/adapters', () => ({
  createTelegramAdapter: vi.fn(() => ({
    verifyWebhook: vi.fn().mockReturnValue(true),
    handle: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock the MessageBridge with configurable mock instances
let mockGetAdapter: ReturnType<typeof vi.fn>
let mockHandleInbound: ReturnType<typeof vi.fn>
let mockBridgeInstance: any

// Default mock adapter for basic verification tests
const defaultAdapter = {
  verifyWebhook: vi.fn().mockReturnValue(true),
  handle: vi.fn(),
}

vi.mock('@/lib/messaging/bridge', () => {
  return {
    MessageBridge: vi.fn().mockImplementation(function(this: any) {
      this.getAdapter = mockGetAdapter
      this.handleInbound = mockHandleInbound
      mockBridgeInstance = this
    }),
  }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

import { createTelegramAdapter } from '@/lib/messaging/adapters'
import type { Route } from '@/routes/api/messaging/webhook'

async function getHandler() {
  const mod = await import('../webhook')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>, platform: string = 'telegram'): Request {
  const url = `http://localhost:3025/api/messaging/webhook?platform=${platform}`
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/messaging/webhook', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    // Reset mock functions to defaults after module reset
    mockGetAdapter = vi.fn().mockReturnValue({
      verifyWebhook: vi.fn().mockReturnValue(true),
      handle: vi.fn().mockResolvedValue(undefined),
    })
    mockHandleInbound = vi.fn().mockResolvedValue(undefined)
  })

  it('returns 200 when platform parameter is missing', async () => {
    const handler = await getHandler()
    const response = await handler({ request: new Request('http://localhost:3025/api/messaging/webhook') })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; error?: string }
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/Missing platform/i)
  })

  it('returns 200 when request body is invalid JSON', async () => {
    const handler = await getHandler()
    const invalidJsonRequest = new Request('http://localhost:3025/api/messaging/webhook?platform=telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })

    const response = await handler({ request: invalidJsonRequest })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; error?: string }
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/Invalid JSON/i)
  })

  it('returns 200 when webhook verification fails', async () => {
    // Configure mock: verification fails
    mockGetAdapter = vi.fn().mockReturnValue({
      verifyWebhook: vi.fn(() => false),
      handle: vi.fn(),
    })
    mockHandleInbound = vi.fn().mockResolvedValue(undefined)

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ message: 'test' }, 'telegram'),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; error?: string }
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/verification failed/i)
  })

  it('returns 200 when adapter not found for platform', async () => {
    // Configure mock: getAdapter returns undefined for unknown platform
    mockGetAdapter = vi.fn().mockReturnValue(undefined)
    mockHandleInbound = vi.fn().mockResolvedValue(null)

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ message: 'test' }, 'unknown-platform'),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; response?: unknown }
    expect(json).toHaveProperty('ok') // Returns ok:true even when no adapter (no error)
  })

  it('returns 200 when handleInbound throws', async () => {
    // Configure mock: handleInbound throws
    mockGetAdapter = vi.fn().mockReturnValue({
      verifyWebhook: vi.fn(() => true),
      handle: vi.fn(),
    })
    mockHandleInbound = vi.fn().mockRejectedValue(new Error('Processing error'))

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ message: 'test' }, 'telegram'),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean }
    expect(json.ok).toBe(false)
  })

  it('returns 200 with ok:true when handleInbound succeeds without response', async () => {
    // Configure mock: handleInbound returns null (no response data)
    mockGetAdapter = vi.fn().mockReturnValue({
      verifyWebhook: vi.fn(() => true),
      handle: vi.fn(),
    })
    mockHandleInbound = vi.fn().mockResolvedValue(null)

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ message: 'test' }, 'telegram'),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; response?: unknown }
    expect(json.ok).toBe(true)
    expect(json.response).toBeUndefined()
  })

  it('returns 200 with ok:true and response data when handleInbound returns response', async () => {
    // Configure mock: handleInbound returns response data
    mockGetAdapter = vi.fn().mockReturnValue({
      verifyWebhook: vi.fn(() => true),
      handle: vi.fn(),
    })
    mockHandleInbound = vi.fn().mockResolvedValue({
      response: { status: 'delivered', messageId: 'msg_123' },
    })

    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ message: 'test' }, 'telegram'),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; response: { status: string; messageId: string } }
    expect(json.ok).toBe(true)
    expect(json.response).toEqual({ status: 'delivered', messageId: 'msg_123' })
  })

  it('passes raw payload to handleInbound', async () => {
    // Configure mock
    mockGetAdapter = vi.fn().mockReturnValue({
      verifyWebhook: vi.fn(() => true),
      handle: vi.fn(),
    })
    mockHandleInbound = vi.fn().mockResolvedValue(null)

    const handler = await getHandler()

    const rawPayload = {
      update_id: 123456,
      message: {
        message_id: 1,
        from: { id: 111, username: 'testuser' },
        chat: { id: 111, type: 'private' },
        text: 'Hello',
      },
    }

    await handler({
      request: buildRequest(rawPayload, 'telegram'),
    })

    expect(mockHandleInbound).toHaveBeenCalledWith('telegram', rawPayload)
  })

  it('uses correct adapter based on platform query param', async () => {
    // Configure mock: getAdapter returns different adapters per platform
    const telegramAdapter = {
      verifyWebhook: vi.fn(() => true),
      handle: vi.fn(),
    }
    const smsAdapter = {
      verifyWebhook: vi.fn(() => true),
      handle: vi.fn(),
    }

    mockGetAdapter = vi.fn((platform: string) => {
      if (platform === 'telegram') return telegramAdapter
      if (platform === 'sms') return smsAdapter
      return undefined
    })
    mockHandleInbound = vi.fn().mockResolvedValue(null)

    const handler = await getHandler()

    await handler({
      request: buildRequest({ message: 'test' }, 'telegram'),
    })
    expect(mockGetAdapter).toHaveBeenCalledWith('telegram')

    await handler({
      request: buildRequest({ message: 'test' }, 'sms'),
    })
    expect(mockGetAdapter).toHaveBeenCalledWith('sms')
  })
})
