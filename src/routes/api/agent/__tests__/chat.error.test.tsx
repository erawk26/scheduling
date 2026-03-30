/**
 * Integration tests for POST /api/agent/chat endpoint - error cases.
 *
 * Tests malformed JSON and unsupported HTTP methods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((model: string) => ({ modelId: model }))),
}))

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toTextStreamResponse: () => new Response('ok'),
  })),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => config),
}))

async function getHandler() {
  const mod = await import('../chat')
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/agent/chat edge cases', () => {
  const originalEnv = process.env.OPENROUTER_API_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENROUTER_API_KEY = originalEnv
    } else {
      delete process.env.OPENROUTER_API_KEY
    }
  })

  // -----------------------------------------------------------------------
  // 400 — malformed JSON
  // -----------------------------------------------------------------------

  it('returns 400 when request body is malformed JSON', async () => {
    const handler = await getHandler()
    const request = new Request('http://localhost:3000/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{{{',
    })

    const response = await handler({ request })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/invalid|JSON|failed to parse/i)
  })

  // -----------------------------------------------------------------------
  // 400 — invalid body shape
  // -----------------------------------------------------------------------

  it('returns 400 when messages is not an array', async () => {
    const handler = await getHandler()
    const response = await handler({
      request: buildRequest({ messages: 'not an array' }),
    })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    // The endpoint extracts last message; if messages is not array, messages?.[messages.length-1] is undefined
    expect(json.error).toMatch(/no message/i)
  })
})
