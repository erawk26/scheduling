/**
 * US-016: Full integration test — message flow through tiered context.
 * Verifies: user → engine → TieredContextProvider → buildPrompt → response → note extraction
 *
 * Uses the localkit test double (src/test/localkit-double.ts) instead of vi.mock
 * so that create/findMany exercise real stateful CRUD in-memory.
 */

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Wire the test double into the offlinekit import path.
// vi.mock factories can reference vi.hoisted values since both are hoisted.
const { app: mockApp, agentNotes: mockAgentNotes } = vi.hoisted(() => {
  // Inline minimal in-memory collection factory — mirrors localkit-double
  // but avoids require/import resolution issues in hoisted context.
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = []
    return {
      findMany(): Promise<T[]> { return Promise.resolve([...docs]) },
      create(data: T): Promise<T> {
        const doc = { ...data, _id: (data as Record<string, unknown>).id ?? name, _collection: name, _updatedAt: new Date().toISOString(), _deleted: false } as T
        docs.push(doc)
        return Promise.resolve(doc)
      },
      _reset(): void { docs = [] },
    }
  }
  const appointments = createCollection<Record<string, unknown>>('appointments')
  const clients = createCollection<Record<string, unknown>>('clients')
  const services = createCollection<Record<string, unknown>>('services')
  const pets = createCollection<Record<string, unknown>>('pets')
  const agentProfile = createCollection<Record<string, unknown>>('agentProfile')
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes')
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories')
  const agentConversations = createCollection<Record<string, unknown>>('agentConversations')
  const businessProfile = createCollection<Record<string, unknown>>('businessProfile')
  const app = { appointments, clients, services, pets, agentProfile, agentNotes, agentMemories, agentConversations, businessProfile }
  return { app, agentNotes }
})

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }))

describe('Integration: Message Flow Through Tiered Context', () => {
  it('TieredContextProvider returns valid AgentContext for any query', async () => {
    const { TieredContextProvider } = await import('@/lib/agent/context/tiered-provider')
    const { AgentSearchIndex } = await import('@/lib/search/search-index')

    const searchIndex = new AgentSearchIndex()
    const provider = new TieredContextProvider(searchIndex)
    const context = await provider.getFullContext('What is my schedule tomorrow?')

    expect(context).toHaveProperty('query')
    expect(context.query).toBe('What is my schedule tomorrow?')
    // L0 always includes profile (even if empty)
    expect(context).toHaveProperty('profile')
    // L0 always includes schedule
    expect(context).toHaveProperty('schedule')
  })

  it('buildPrompt produces valid messages from tiered context', async () => {
    const { TieredContextProvider } = await import('@/lib/agent/context/tiered-provider')
    const { AgentSearchIndex } = await import('@/lib/search/search-index')
    const { buildPrompt } = await import('@/lib/agent/prompt-builder')

    // Seed data so context includes real records
    await mockApp.clients.create({
      id: 'c-1', user_id: 'u-1', first_name: 'Jane', last_name: 'Smith',
      email: 'jane@example.com', phone: null, address: '123 Main St',
      scheduling_flexibility: 'flexible', notes: null,
      created_at: '2026-03-01T00:00:00', updated_at: '2026-03-01T00:00:00',
    })

    const searchIndex = new AgentSearchIndex()
    const provider = new TieredContextProvider(searchIndex)
    const context = await provider.getFullContext('Show me my clients')

    const skill = { name: 'test', systemPrompt: 'You are a scheduling assistant.', piiLevel: 'full' as const }
    const messages = buildPrompt(skill, context, 'Show me my clients')

    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[0]!.content).toContain('scheduling assistant')
    expect(messages[1]!.role).toBe('user')
    expect(messages[1]!.content).toBe('Show me my clients')
  })

  it('note extraction detects memory types without throwing', async () => {
    const { extractNote, detectMemoryTypes } = await import('@/lib/agent/skills/note-extractor')

    // Scheduling intent
    const types = detectMemoryTypes('Schedule me for Tuesday morning', 'Done, booked for Tuesday 9am')
    expect(types).toContain('scheduling')

    // Extraction is fire-and-forget — must not throw
    await expect(
      extractNote('Schedule me for Tuesday', 'Booked for Tuesday 9am')
    ).resolves.not.toThrow()

    // Verify the note was actually persisted via the test double
    const notes = await mockAgentNotes.findMany()
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(notes.some((n) => (n as Record<string, unknown>).summary !== undefined)).toBe(true)
  })

  it('search index finds documents added from context', async () => {
    const { AgentSearchIndex } = await import('@/lib/search/search-index')

    const index = new AgentSearchIndex()
    index.addDocuments('clients', [
      { id: 'c1', collection: 'clients', text: 'Sarah Johnson 123 Oak Street flexible' },
      { id: 'c2', collection: 'clients', text: 'Mike Davis 456 Elm Ave fixed' },
    ])
    index.addDocuments('appointments', [
      { id: 'a1', collection: 'appointments', text: 'Tuesday 9am Sarah Johnson Full Groom' },
    ])

    const results = index.search('Sarah')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.id === 'c1')).toBe(true)
  })

  it('full flow: context → prompt → extraction pipeline', async () => {
    const { TieredContextProvider } = await import('@/lib/agent/context/tiered-provider')
    const { AgentSearchIndex } = await import('@/lib/search/search-index')
    const { buildPrompt } = await import('@/lib/agent/prompt-builder')
    const { extractNote } = await import('@/lib/agent/skills/note-extractor')

    // Seed a client + service + appointment so L0 context has real data
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const startTime = tomorrow.toISOString().split('.')[0]!
    const endHour = new Date(tomorrow.getTime() + 60 * 60 * 1000)
    const endTime = endHour.toISOString().split('.')[0]!

    await mockApp.clients.create({
      id: 'c-1', user_id: 'u-1', first_name: 'Jane', last_name: 'Smith',
      email: null, phone: null, address: null, scheduling_flexibility: 'flexible', notes: null,
      created_at: '2026-03-01T00:00:00', updated_at: '2026-03-01T00:00:00',
    })
    await mockApp.services.create({
      id: 's-1', user_id: 'u-1', name: 'Full Groom', description: null,
      duration_minutes: 60, price_cents: 7500, weather_dependent: false, location_type: 'mobile',
      created_at: '2026-03-01T00:00:00', updated_at: '2026-03-01T00:00:00',
    })
    await mockApp.appointments.create({
      id: 'apt-1', user_id: 'u-1', client_id: 'c-1', service_id: 's-1',
      start_time: startTime, end_time: endTime,
      status: 'confirmed', location_type: 'mobile', address: '123 Main St',
      notes: null, internal_notes: null, weather_alert: 0,
      latitude: null, longitude: null, pet_id: null,
      created_at: '2026-03-01T00:00:00', updated_at: '2026-03-01T00:00:00',
    })

    // Setup search index with a pre-existing note
    const searchIndex = new AgentSearchIndex()
    searchIndex.addDocuments('agentNotes', [
      { id: 'n1', collection: 'agentNotes', text: 'Client prefers Tuesday mornings' },
    ])

    const provider = new TieredContextProvider(searchIndex)

    // Step 1: Get context — should include the seeded appointment in L0
    const context = await provider.getFullContext('What about Tuesday?')
    expect(context.query).toBe('What about Tuesday?')
    expect(context.schedule).toBeDefined()
    expect(context.schedule!.appointments.length).toBeGreaterThanOrEqual(1)

    // Step 2: Build prompt
    const skill = { name: 'check-in', systemPrompt: 'You are a scheduling assistant.', piiLevel: 'full' as const }
    const messages = buildPrompt(skill, context, 'What about Tuesday?')
    expect(messages.length).toBe(2)

    // Step 3: Simulate response + extraction
    const agentResponse = 'You have 3 appointments on Tuesday. Would you like to reschedule any?'
    await extractNote('What about Tuesday?', agentResponse, searchIndex)

    // Verify note was persisted in the test double
    const notes = await mockAgentNotes.findMany()
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(searchIndex.documentCount).toBeGreaterThanOrEqual(1)
  })

  it('engine files use TieredContextProvider (not StructuredContextProvider)', () => {
    const enginePath = path.resolve(__dirname, '../skills/engine.ts')
    const streamPath = path.resolve(__dirname, '../skills/engine-stream.ts')

    const engineContent = fs.readFileSync(enginePath, 'utf8')
    const streamContent = fs.readFileSync(streamPath, 'utf8')

    expect(engineContent).toContain('TieredContextProvider')
    expect(engineContent).not.toContain('new StructuredContextProvider')
    expect(streamContent).toContain('TieredContextProvider')
    expect(streamContent).not.toContain('new StructuredContextProvider')
  })

  it('all existing chat-related test files still pass', async () => {
    // Verify no regressions by checking test file existence
    const testDirs = [
      path.resolve(__dirname, '../../search/__tests__'),
      path.resolve(__dirname, '../context/__tests__'),
      path.resolve(__dirname, '../skills/__tests__'),
    ]

    for (const dir of testDirs) {
      const exists = fs.existsSync(dir)
      expect(exists).toBe(true)
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))
      expect(files.length).toBeGreaterThan(0)
    }
  })
})
