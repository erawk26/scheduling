/**
 * Integration tests for POST /api/agent/chat endpoint.
 *
 * Mocks @ai-sdk/openai and ai SDK to avoid real API calls.
 * Verifies error responses (503, 400) and streaming success (200).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock ai SDK streamText — must be hoisted before route module loads
// ---------------------------------------------------------------------------

const mockStreamText = vi.hoisted(() => vi.fn())

vi.mock('ai', () => ({
  streamText: mockStreamText,
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() =>
    vi.fn((model: string) => ({ modelId: model })),
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => config),
}))

// ---------------------------------------------------------------------------
// Import the handler AFTER mocks are wired
// ---------------------------------------------------------------------------

async function getHandler() {
  const mod = await import('../chat')
  // createFileRoute returns a function that receives the config object.
  // Our mock makes createFileRoute return a passthrough, so Route IS that config.
  const route = mod.Route as unknown as {
    server: { handlers: { POST: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.POST
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3025/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Consume a ReadableStream<Uint8Array> and return the concatenated text. */
async function drainStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let result = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }
  return result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/agent/chat', () => {
  const originalEnv = process.env.OPENROUTER_API_KEY

  beforeEach(() => {
    vi.resetModules()
    mockStreamText.mockReset()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENROUTER_API_KEY = originalEnv
    } else {
      delete process.env.OPENROUTER_API_KEY
    }
  })

  // -------------------------------------------------------------------------
  // 503 — missing API key
  // -------------------------------------------------------------------------

  it('returns 503 when OPENROUTER_API_KEY is not set', async () => {
    delete process.env.OPENROUTER_API_KEY

    const handler = await getHandler()
    const request = buildRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    const response = await handler({ request })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/not configured/i)
  })

  // -------------------------------------------------------------------------
  // 400 — missing message
  // -------------------------------------------------------------------------

  it('returns 400 when no message content is provided', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const handler = await getHandler()

    // Empty messages array → last message content is undefined
    const response = await handler({ request: buildRequest({ messages: [] }) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/no message/i)
  })

  it('returns 400 when messages field is missing', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const handler = await getHandler()
    const response = await handler({ request: buildRequest({}) })

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toMatch(/no message/i)
  })

  // -------------------------------------------------------------------------
  // 200 — valid streaming response
  // -------------------------------------------------------------------------

  it('returns a Response with ReadableStream body on valid request', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('Hello'))
        controller.enqueue(encoder.encode(' world'))
        controller.close()
      },
    })

    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    })

    const handler = await getHandler()
    const request = buildRequest({
      messages: [{ role: 'user', content: 'Hi there' }],
    })

    const response = await handler({ request })

    expect(response.status).toBe(200)
    expect(response.body).toBeInstanceOf(ReadableStream)
  })

  it('streams text chunks that can be consumed', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const parts = ['Schedule', ' confirmed', ' for Tuesday']
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(encoder.encode(part))
        }
        controller.close()
      },
    })

    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    })

    const handler = await getHandler()
    const request = buildRequest({
      messages: [
        { role: 'user', content: 'Schedule me for Tuesday' },
      ],
      system: 'You are a scheduling bot.',
    })

    const response = await handler({ request })
    expect(response.status).toBe(200)

    const text = await drainStream(response.body!)
    expect(text).toBe('Schedule confirmed for Tuesday')
  })

  it('passes system prompt and messages to streamText', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    mockStreamText.mockReturnValue({
      toTextStreamResponse: () => new Response('ok'),
    })

    const handler = await getHandler()
    const request = buildRequest({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Book Tuesday' },
      ],
      system: 'Custom system prompt',
    })

    await handler({ request })

    expect(mockStreamText).toHaveBeenCalledOnce()
    const call = mockStreamText.mock.calls[0]![0] as {
      model: unknown
      system: string
      messages: Array<{ role: string; content: string }>
    }
    expect(call.system).toBe('Custom system prompt')
    expect(call.messages).toHaveLength(3)
    expect(call.messages[2]).toEqual({ role: 'user', content: 'Book Tuesday' })
  })
})
