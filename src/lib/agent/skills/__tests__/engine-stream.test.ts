/**
 * Integration test for processMessageStream() — the streaming skill engine.
 *
 * Verifies the full flow: route → budget check → build messages → stream →
 * store conversations → log usage → extract notes → budget warning.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.mock factories reference these via vi.hoisted
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  // Minimal in-memory collection (same pattern as integration-flow.test.ts)
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = []
    return {
      findMany(): Promise<T[]> { return Promise.resolve([...docs]) },
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
      _reset(): void { docs = [] },
      _raw(): T[] { return docs },
    }
  }

  const agentConversations = createCollection<Record<string, unknown>>('agentConversations')
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories')
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes')

  const app = {
    appointments: createCollection<Record<string, unknown>>('appointments'),
    clients: createCollection<Record<string, unknown>>('clients'),
    services: createCollection<Record<string, unknown>>('services'),
    pets: createCollection<Record<string, unknown>>('pets'),
    agentProfile: createCollection<Record<string, unknown>>('agentProfile'),
    businessProfile: createCollection<Record<string, unknown>>('businessProfile'),
    agentNotes,
    agentMemories,
    agentConversations,
  }

  return { app, agentConversations, agentMemories, agentNotes }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/offlinekit', () => ({ app: mocks.app }))

// Mock TieredContextProvider so getFullContext doesn't hit real storage
vi.mock('@/lib/agent/context/tiered-provider', () => ({
  TieredContextProvider: class {
    getFullContext() {
      return Promise.resolve({
        profile: { sections: [] },
        schedule: { appointments: [] },
        clients: { clients: [] },
        notes: { notes: [] },
      })
    }
  },
}))

// Mock sendMessageStream — returns a simple ReadableStream of plain text chunks
const mockSendMessageStream = vi.fn<
  Parameters<typeof import('@/lib/agent/openrouter-client').sendMessageStream>,
  ReturnType<typeof import('@/lib/agent/openrouter-client').sendMessageStream>
>()

vi.mock('@/lib/agent/openrouter-client', () => ({
  sendMessageStream: mockSendMessageStream,
}))

// Mock extractNote as a spy so we can verify calls
const mockExtractNote = vi.fn<
  Parameters<typeof import('../note-extractor').extractNote>,
  ReturnType<typeof import('../note-extractor').extractNote>
>().mockResolvedValue(undefined)

vi.mock('../note-extractor', () => ({
  extractNote: mockExtractNote,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a ReadableStream<Uint8Array> that emits plain text chunks. */
function createPlainStream(parts: string[]): ReadableStream<Uint8Array> {
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

/** Consume a ReadableStream<Uint8Array> and return the full text. */
async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }
  return result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMessageStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agentConversations._reset()
    mocks.agentMemories._reset()
    mocks.agentNotes._reset()
    mocks.app.appointments._reset()
    mocks.app.clients._reset()
    mocks.app.services._reset()

    // Default: sendMessageStream returns a simple stream
    mockSendMessageStream.mockReturnValue(
      createPlainStream(['Hello', ' from', ' the', ' assistant!'])
    )
  })

  it('routes message, streams response, stores conversations, logs usage, and extracts notes', async () => {
    const { processMessageStream } = await import('../engine-stream')

    // "What's my week looking like?" routes to check-in skill
    const stream = processMessageStream("What's my week looking like?")
    const output = await consumeStream(stream)

    // 1. Stream chunks flow through correctly
    expect(output).toBe('Hello from the assistant!')

    // 2. sendMessageStream was called with messages array
    expect(mockSendMessageStream).toHaveBeenCalledTimes(1)
    const messages = mockSendMessageStream.mock.calls[0]![0]
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
    expect(messages[1]!.content).toBe("What's my week looking like?")

    // 3. storeConversation called twice: user message + agent response
    const conversations = mocks.agentConversations._raw()
    expect(conversations).toHaveLength(2)

    const userEntry = conversations.find(c => c.role === 'user')
    const agentEntry = conversations.find(c => c.role === 'agent')
    expect(userEntry).toBeDefined()
    expect(userEntry!.content).toBe("What's my week looking like?")
    expect(agentEntry).toBeDefined()
    expect(agentEntry!.content).toBe('Hello from the assistant!')
    // Agent entry should have context with skillName
    expect(agentEntry!.context).toEqual({ skillName: 'check-in' })

    // 4. logUsage called — creates an agentMemories entry
    const memories = mocks.agentMemories._raw()
    expect(memories).toHaveLength(1)
    const usageLog = memories[0]!
    expect(usageLog.type).toBe('usage-log')
    const payload = usageLog.payload as { tokens: number; skill: string }
    expect(payload.skill).toBe('check-in')
    // Estimated tokens = Math.ceil(fullResponse.length / 4)
    expect(payload.tokens).toBe(Math.ceil('Hello from the assistant!'.length / 4))

    // 5. extractNote called fire-and-forget after stream completes
    expect(mockExtractNote).toHaveBeenCalledTimes(1)
    expect(mockExtractNote).toHaveBeenCalledWith(
      "What's my week looking like?",
      'Hello from the assistant!',
      expect.anything() // searchIndex instance
    )
  })

  it('appends budget warning when usage exceeds 80% threshold', async () => {
    // Seed agentMemories so getMonthlyUsage returns > 80% of 100k limit
    const currentMonth = new Date().toISOString().slice(0, 7)
    await mocks.agentMemories.create({
      id: 'usage-high',
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'usage-log',
      payload: { tokens: 85000, skill: 'check-in', month: currentMonth },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })

    const { processMessageStream } = await import('../engine-stream')

    const stream = processMessageStream("What's my week looking like?")
    const output = await consumeStream(stream)

    // Should include the LLM response AND the budget warning appended
    expect(output).toContain('Hello from the assistant!')
    expect(output).toContain('running low on my monthly thinking budget')
    expect(output).toContain('85%')
  })

  it('blocks request and returns budget exceeded message at 95% threshold', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    await mocks.agentMemories.create({
      id: 'usage-exceeded',
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'usage-log',
      payload: { tokens: 96000, skill: 'check-in', month: currentMonth },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })

    const { processMessageStream } = await import('../engine-stream')

    const stream = processMessageStream("What's my week looking like?")
    const output = await consumeStream(stream)

    // Budget exceeded — should NOT call sendMessageStream
    expect(mockSendMessageStream).not.toHaveBeenCalled()
    expect(output).toContain('hit my thinking budget')

    // Should still store both user + agent conversation entries
    const conversations = mocks.agentConversations._raw()
    expect(conversations).toHaveLength(2)
  })

  it('streams fallback error message when sendMessageStream throws', async () => {
    mockSendMessageStream.mockImplementation(() => {
      return new ReadableStream<Uint8Array>({
        start() {
          throw new Error('Network failure')
        },
      })
    })

    const { processMessageStream } = await import('../engine-stream')

    const stream = processMessageStream("What's my schedule tomorrow?")
    const output = await consumeStream(stream)

    expect(output).toBe("I'm having trouble right now. Please try again in a moment.")
  })

  it('handles general conversation when no skill matches', async () => {
    const { processMessageStream } = await import('../engine-stream')

    // "Hello there" doesn't match any skill pattern
    const stream = processMessageStream('Hello there')
    const output = await consumeStream(stream)

    expect(output).toBe('Hello from the assistant!')

    // System prompt should be the default assistant prompt
    const messages = mockSendMessageStream.mock.calls[0]![0]
    expect(messages[0]!.content).toContain('helpful scheduling assistant')

    // Agent conversation stored with skillName 'general'
    const conversations = mocks.agentConversations._raw()
    const agentEntry = conversations.find(c => c.role === 'agent')
    expect(agentEntry!.context).toEqual({ skillName: 'general' })
  })

  it('uses client-provided context when passed', async () => {
    const { processMessageStream } = await import('../engine-stream')

    const clientContext = {
      profile: {
        sections: [{ section_id: 'business', content: { name: 'Pawfect Grooming' } }],
      },
      schedule: {
        appointments: [
          { start_time: '2026-03-30T09:00:00', clientName: 'Jane', serviceName: 'Full Groom', address: '123 Main St' },
        ],
      },
    }

    const stream = processMessageStream("What's my week looking like?", clientContext)
    const output = await consumeStream(stream)

    expect(output).toBe('Hello from the assistant!')

    // System prompt should include the serialized client context
    const messages = mockSendMessageStream.mock.calls[0]![0]
    expect(messages[0]!.content).toContain('Pawfect Grooming')
    expect(messages[0]!.content).toContain('Jane')
    expect(messages[0]!.content).toContain('Full Groom')
  })
})
