/**
 * Unit tests for processMessage() in engine.ts.
 *
 * Verifies:
 * - Skill-matched path: routeMessage → skill.execute → storeConversation × 2 → logUsage
 * - General path (no skill): routeMessage(null) → sendMessage → storeConversation × 2 → logUsage
 * - Budget exceeded path: early return without LLM call
 *
 * Uses vi.mock to isolate engine from real dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — these must be defined before vi.mock factories run
// ---------------------------------------------------------------------------

const { mockApp } = vi.hoisted(() => {
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
      _raw(): T[] { return docs },
      _reset(): void { docs = [] },
    }
  }

  const agentConversations = createCollection<Record<string, unknown>>('agentConversations')
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories')
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes')
  const agentProfile = createCollection<Record<string, unknown>>('agentProfile')
  const appointments = createCollection<Record<string, unknown>>('appointments')
  const businessProfile = createCollection<Record<string, unknown>>('businessProfile')
  const clients = createCollection<Record<string, unknown>>('clients')
  const pets = createCollection<Record<string, unknown>>('pets')
  const services = createCollection<Record<string, unknown>>('services')

  const mockApp = {
    agentConversations,
    agentMemories,
    agentNotes,
    agentProfile,
    appointments,
    businessProfile,
    clients,
    pets,
    services,
  }
  return { mockApp }
})

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }))

// Mock search index — engine.ts instantiates AgentSearchIndex at module scope
vi.mock('@/lib/search/search-index', () => ({
  AgentSearchIndex: class {
    addDocuments = vi.fn()
    search = vi.fn().mockReturnValue([])
  },
}))

// Mock TieredContextProvider — engine.ts instantiates at module scope
vi.mock('@/lib/agent/context/tiered-provider', () => ({
  TieredContextProvider: class {
    getFullContext = vi.fn().mockResolvedValue({ query: '', profile: {}, schedule: { appointments: [] } })
  },
}))

// Mock router — controlled per test
const mockRouteMessage = vi.fn()
vi.mock('../router', () => ({
  routeMessage: (...args: unknown[]) => mockRouteMessage(...args),
}))

// Mock token budget — controlled per test
const mockGetMonthlyUsage = vi.fn()
const mockCheckBudget = vi.fn()
const mockLogUsage = vi.fn()
vi.mock('@/lib/agent/token-budget', () => ({
  getMonthlyUsage: (...args: unknown[]) => mockGetMonthlyUsage(...args),
  checkBudget: (...args: unknown[]) => mockCheckBudget(...args),
  logUsage: (...args: unknown[]) => mockLogUsage(...args),
}))

// Mock openrouter-client — used for general conversation fallback
const mockSendMessage = vi.fn()
vi.mock('@/lib/agent/openrouter-client', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('processMessage()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApp.agentConversations._reset()
    mockApp.agentMemories._reset()

    // Default: budget allowed, no warning
    mockGetMonthlyUsage.mockResolvedValue(0)
    mockCheckBudget.mockReturnValue({ allowed: true, remaining: 100000 })
    mockLogUsage.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // Skill-matched path
  // -------------------------------------------------------------------------

  describe('when a skill is matched', () => {
    const fakeSkill = {
      name: 'check-in',
      description: 'Check schedule',
      tier: 'L0' as const,
      contextRequirements: [],
      writeActions: [],
      piiLevel: 'full' as const,
      execute: vi.fn(),
    }

    beforeEach(() => {
      mockRouteMessage.mockReturnValue(fakeSkill)
      fakeSkill.execute.mockResolvedValue({
        response: {
          content: 'You have 3 appointments tomorrow.',
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        },
        skillName: 'check-in',
      })
    })

    it('routes the message to the correct skill', async () => {
      const { processMessage } = await import('../engine')
      await processMessage("What's on my schedule tomorrow?")

      expect(mockRouteMessage).toHaveBeenCalledWith("What's on my schedule tomorrow?")
    })

    it('checks the token budget before calling the skill', async () => {
      const { processMessage } = await import('../engine')
      await processMessage("What's on my schedule?")

      expect(mockGetMonthlyUsage).toHaveBeenCalled()
      expect(mockCheckBudget).toHaveBeenCalledWith(0)
    })

    it('calls skill.execute with contextProvider and userMessage', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('Show me my week')

      expect(fakeSkill.execute).toHaveBeenCalledTimes(1)
      const [ctxProvider, msg] = fakeSkill.execute.mock.calls[0]!
      expect(msg).toBe('Show me my week')
      // contextProvider is an object with getFullContext
      expect(ctxProvider).toHaveProperty('getFullContext')
    })

    it('stores both user and agent messages in agentConversations', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('Check my schedule')

      const conversations = mockApp.agentConversations._raw()
      expect(conversations).toHaveLength(2)

      const userEntry = conversations.find((c) => c.role === 'user')
      const agentEntry = conversations.find((c) => c.role === 'agent')

      expect(userEntry).toBeDefined()
      expect(userEntry!.content).toBe('Check my schedule')

      expect(agentEntry).toBeDefined()
      expect(agentEntry!.content).toBe('You have 3 appointments tomorrow.')
    })

    it('logs token usage with total_tokens and skill name', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('My week')

      expect(mockLogUsage).toHaveBeenCalledWith(150, 'check-in', mockApp)
    })

    it('returns the agent response', async () => {
      const { processMessage } = await import('../engine')
      const result = await processMessage('Tomorrow?')

      expect(result.content).toBe('You have 3 appointments tomorrow.')
      expect(result.usage.total_tokens).toBe(150)
    })

    it('does NOT call sendMessage for skill-matched messages', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('My schedule')

      expect(mockSendMessage).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // General conversation path (no skill matched)
  // -------------------------------------------------------------------------

  describe('when no skill is matched (general conversation)', () => {
    beforeEach(() => {
      mockRouteMessage.mockReturnValue(null)
      mockSendMessage.mockResolvedValue({
        content: 'I can help with scheduling questions!',
        usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
      })
    })

    it('calls sendMessage from openrouter-client', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('Hello there!')

      expect(mockSendMessage).toHaveBeenCalledTimes(1)
      const messages = mockSendMessage.mock.calls[0]![0]
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('Hello there!')
    })

    it('stores both user and agent messages', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('Hi!')

      const conversations = mockApp.agentConversations._raw()
      expect(conversations).toHaveLength(2)

      const userEntry = conversations.find((c) => c.role === 'user')
      const agentEntry = conversations.find((c) => c.role === 'agent')

      expect(userEntry!.content).toBe('Hi!')
      expect(agentEntry!.content).toBe('I can help with scheduling questions!')
    })

    it('logs usage with skill name "general"', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('Hey')

      expect(mockLogUsage).toHaveBeenCalledWith(100, 'general', mockApp)
    })

    it('returns the response from sendMessage', async () => {
      const { processMessage } = await import('../engine')
      const result = await processMessage('What can you do?')

      expect(result.content).toBe('I can help with scheduling questions!')
      expect(result.usage.total_tokens).toBe(100)
    })
  })

  // -------------------------------------------------------------------------
  // Budget exceeded path
  // -------------------------------------------------------------------------

  describe('when budget is exceeded', () => {
    beforeEach(() => {
      mockGetMonthlyUsage.mockResolvedValue(96000)
      mockCheckBudget.mockReturnValue({
        allowed: false,
        remaining: 0,
        warning: "I've hit my thinking budget for the month. Please check back next month.",
      })
    })

    it('returns budget exceeded message without calling skill or sendMessage', async () => {
      const { processMessage } = await import('../engine')
      const result = await processMessage('Build my schedule')

      expect(result.content).toBe(
        "I've hit my thinking budget for the month. Please check back next month."
      )
      expect(result.usage.total_tokens).toBe(0)
      expect(mockRouteMessage).not.toHaveBeenCalled()
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('still stores the user and agent conversation entries', async () => {
      const { processMessage } = await import('../engine')
      await processMessage('Build my schedule')

      const conversations = mockApp.agentConversations._raw()
      expect(conversations).toHaveLength(2)

      const userEntry = conversations.find((c) => c.role === 'user')
      expect(userEntry!.content).toBe('Build my schedule')
    })
  })

  // -------------------------------------------------------------------------
  // Budget warning path
  // -------------------------------------------------------------------------

  describe('when budget has a warning but is still allowed', () => {
    beforeEach(() => {
      mockGetMonthlyUsage.mockResolvedValue(85000)
      mockCheckBudget.mockReturnValue({
        allowed: true,
        remaining: 15000,
        warning: "I'm running low on my monthly thinking budget (85% used).",
      })
      mockRouteMessage.mockReturnValue(null)
      mockSendMessage.mockResolvedValue({
        content: 'Here is your answer.',
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
      })
    })

    it('appends budget warning to the response content', async () => {
      const { processMessage } = await import('../engine')
      const result = await processMessage('Tell me something')

      expect(result.content).toContain('Here is your answer.')
      expect(result.content).toContain('running low on my monthly thinking budget')
    })
  })
})
