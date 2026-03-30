/**
 * Integration test for createChatModelAdapter().
 *
 * Verifies the full client-side chat flow:
 * 1. contextProvider.getFullContext() called with user message
 * 2. fetch('/api/agent/chat') called with correct body
 * 3. Streaming response consumed and yielded as content parts
 * 4. Messages persisted to agentConversations
 * 5. Token usage logged via logUsage()
 * 6. deriveTitle + updateThreadTitle on first user message
 * 7. updateThreadTimestamp called after response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any vi.mock calls
// ---------------------------------------------------------------------------

const { mockApp, mockAgentConversations } = vi.hoisted(() => {
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = []
    return {
      findMany(filter?: Partial<T>): Promise<T[]> {
        return Promise.resolve([...docs])
      },
      create(data: T): Promise<T> {
        const doc = {
          ...data,
          _id: (data as Record<string, unknown>).id ?? name,
          _collection: name,
          _updatedAt: new Date().toISOString(),
          _deleted: false,
        } as T
        docs.push(doc)
        return Promise.resolve(doc)
      },
      update(id: string, data: Partial<T>): Promise<T | null> {
        const idx = docs.findIndex((d) => (d as Record<string, unknown>).id === id)
        if (idx === -1) return Promise.resolve(null)
        docs[idx] = { ...docs[idx], ...data } as T
        return Promise.resolve(docs[idx])
      },
      delete(id: string): Promise<boolean> {
        return Promise.resolve(true)
      },
      _raw(): T[] { return docs },
      _reset(): void { docs = [] },
    }
  }

  const agentConversations = createCollection<Record<string, unknown>>('agentConversations')
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories')
  const appointments = createCollection<Record<string, unknown>>('appointments')
  const clients = createCollection<Record<string, unknown>>('clients')
  const services = createCollection<Record<string, unknown>>('services')
  const pets = createCollection<Record<string, unknown>>('pets')
  const agentProfile = createCollection<Record<string, unknown>>('agentProfile')
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes')
  const businessProfile = createCollection<Record<string, unknown>>('businessProfile')

  const app = {
    appointments,
    clients,
    services,
    pets,
    agentProfile,
    agentNotes,
    agentMemories,
    agentConversations,
    businessProfile,
  }

  return { mockApp: app, mockAgentConversations: agentConversations }
})

const mockLogUsage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockDeriveTitle = vi.hoisted(() => vi.fn((text: string) => text.slice(0, 37) + (text.length > 40 ? '...' : '')))
const mockUpdateThreadTitle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockUpdateThreadTimestamp = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockGetFullContext = vi.hoisted(() => vi.fn().mockResolvedValue({
  query: '',
  schedule: { appointments: [], dateRange: { start: '', end: '' } },
  clients: { clients: [] },
  profile: { sections: [] },
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }))

vi.mock('@/lib/agent/token-budget', () => ({
  logUsage: mockLogUsage,
  getMonthlyUsage: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/chat-threads', () => ({
  deriveTitle: mockDeriveTitle,
  updateThreadTitle: mockUpdateThreadTitle,
  updateThreadTimestamp: mockUpdateThreadTimestamp,
  listThreads: vi.fn().mockResolvedValue([]),
  createThread: vi.fn().mockResolvedValue({ id: 't-1', title: 'New', createdAt: '', updatedAt: '' }),
  deleteThread: vi.fn().mockResolvedValue(undefined),
  loadThreadMessages: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/agent/context/tiered-provider', () => ({
  TieredContextProvider: class {
    getFullContext = mockGetFullContext
  },
}))

vi.mock('@/lib/search/search-index', () => ({
  AgentSearchIndex: class {},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a plain-text ReadableStream that yields raw text chunks. */
function createPlainTextStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part))
      }
      controller.close()
    },
  })
}

/** Build a minimal assistant-ui message object. */
function userMessage(id: string, text: string) {
  return {
    id,
    role: 'user' as const,
    content: [{ type: 'text' as const, text }],
  }
}

function assistantMessage(id: string, text: string) {
  return {
    id,
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text }],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createChatModelAdapter', () => {
  let createChatModelAdapter: typeof import('@/app/dashboard/chat/page').createChatModelAdapter

  beforeEach(async () => {
    vi.clearAllMocks()
    mockAgentConversations._reset()
    mockApp.agentMemories._reset()

    // Dynamic import after mocks are wired
    const mod = await import('@/app/dashboard/chat/page')
    createChatModelAdapter = mod.createChatModelAdapter

    // Default fetch mock — returns a plain text stream
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(createPlainTextStream(['Hello', ' world', '!']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
  })

  it('calls contextProvider.getFullContext with the user message text', async () => {
    const adapter = createChatModelAdapter('thread-1', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'What is my schedule?')],
      abortSignal: new AbortController().signal,
    })

    // Consume the generator fully
    const parts = []
    for await (const part of gen) {
      parts.push(part)
    }

    expect(mockGetFullContext).toHaveBeenCalledWith('What is my schedule?')
  })

  it('calls fetch with correct body containing messages and system prompt', async () => {
    const adapter = createChatModelAdapter('thread-1', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'Hello')],
      abortSignal: new AbortController().signal,
    })

    for await (const _ of gen) { /* consume */ }

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/agent/chat')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[0].content).toBe('Hello')
    expect(body.system).toContain('scheduling assistant')
  })

  it('includes context in the system prompt when context has data', async () => {
    mockGetFullContext.mockResolvedValueOnce({
      query: 'test',
      schedule: {
        appointments: [
          { start_time: '2026-04-01T09:00:00', clientName: 'Jane', serviceName: 'Full Groom' },
        ],
        dateRange: { start: '', end: '' },
      },
      clients: {
        clients: [{ first_name: 'Jane', last_name: 'Smith', address: '123 Main' }],
      },
      profile: { sections: [] },
    })

    const adapter = createChatModelAdapter('thread-1', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'schedule')],
      abortSignal: new AbortController().signal,
    })
    for await (const _ of gen) { /* consume */ }

    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.system).toContain('Current context')
    expect(body.system).toContain('Jane')
    expect(body.system).toContain('Full Groom')
    expect(body.system).toContain('123 Main')
  })

  it('yields streaming content parts as text accumulates', async () => {
    const adapter = createChatModelAdapter('thread-1', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'Hi')],
      abortSignal: new AbortController().signal,
    })

    const yielded: Array<{ content: Array<{ type: string; text: string }> }> = []
    for await (const part of gen) {
      yielded.push(part as { content: Array<{ type: string; text: string }> })
    }

    // Should yield incrementally as chunks arrive
    expect(yielded.length).toBeGreaterThanOrEqual(1)

    // Final yield should have the full concatenated text
    const last = yielded[yielded.length - 1]!
    expect(last.content).toHaveLength(1)
    expect(last.content[0]!.type).toBe('text')
    expect(last.content[0]!.text).toBe('Hello world!')
  })

  it('persists user and agent messages to agentConversations', async () => {
    const adapter = createChatModelAdapter('thread-42', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'Book Tuesday')],
      abortSignal: new AbortController().signal,
    })
    for await (const _ of gen) { /* consume */ }

    // Wait a tick for fire-and-forget .catch() promises
    await new Promise((r) => setTimeout(r, 10))

    const docs = mockAgentConversations._raw()
    expect(docs.length).toBe(2)

    const userDoc = docs.find((d) => d.role === 'user')!
    expect(userDoc).toBeDefined()
    expect(userDoc.content).toBe('Book Tuesday')
    expect(userDoc.channel).toBe('thread-42')

    const agentDoc = docs.find((d) => d.role === 'agent')!
    expect(agentDoc).toBeDefined()
    expect(agentDoc.content).toBe('Hello world!')
    expect(agentDoc.channel).toBe('thread-42')
  })

  it('logs token usage via logUsage()', async () => {
    const adapter = createChatModelAdapter('thread-1', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'test query')],
      abortSignal: new AbortController().signal,
    })
    for await (const _ of gen) { /* consume */ }

    expect(mockLogUsage).toHaveBeenCalledTimes(1)
    const [tokens, skill, appArg] = mockLogUsage.mock.calls[0]
    expect(typeof tokens).toBe('number')
    expect(tokens).toBeGreaterThan(0)
    expect(skill).toBe('chat')
    expect(appArg).toBe(mockApp)
  })

  it('calls onFirstMessage (deriveTitle path) on the first user message', async () => {
    const onFirstMessage = vi.fn()
    const adapter = createChatModelAdapter('thread-1', onFirstMessage)

    // First message — should trigger onFirstMessage
    const gen1 = adapter.run({
      messages: [userMessage('m-1', 'My first message')],
      abortSignal: new AbortController().signal,
    })
    for await (const _ of gen1) { /* consume */ }

    expect(onFirstMessage).toHaveBeenCalledTimes(1)
    expect(onFirstMessage).toHaveBeenCalledWith('My first message')
  })

  it('does NOT call onFirstMessage on subsequent messages', async () => {
    const onFirstMessage = vi.fn()
    const adapter = createChatModelAdapter('thread-1', onFirstMessage)

    // Two user messages in history — not the first anymore
    const gen = adapter.run({
      messages: [
        userMessage('m-1', 'First'),
        assistantMessage('a-1', 'Response'),
        userMessage('m-2', 'Second message'),
      ],
      abortSignal: new AbortController().signal,
    })
    for await (const _ of gen) { /* consume */ }

    expect(onFirstMessage).not.toHaveBeenCalled()
  })

  it('calls updateThreadTimestamp after the response completes', async () => {
    const adapter = createChatModelAdapter('thread-99', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'test')],
      abortSignal: new AbortController().signal,
    })
    for await (const _ of gen) { /* consume */ }

    expect(mockUpdateThreadTimestamp).toHaveBeenCalledTimes(1)
    expect(mockUpdateThreadTimestamp).toHaveBeenCalledWith('thread-99')
  })

  it('throws on non-OK API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    )

    const adapter = createChatModelAdapter('thread-1', vi.fn())
    const gen = adapter.run({
      messages: [userMessage('m-1', 'fail')],
      abortSignal: new AbortController().signal,
    })

    await expect(async () => {
      for await (const _ of gen) { /* consume */ }
    }).rejects.toThrow('API error: 500')
  })
})
