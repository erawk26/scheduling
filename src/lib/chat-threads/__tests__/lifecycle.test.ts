/**
 * Chat thread lifecycle integration test.
 *
 * Exercises the full CRUD lifecycle of chat threads and messages
 * against the localkit test double's stateful in-memory collections.
 *
 * Covers: createThread, loadThreadMessages, message persistence,
 * deriveTitle, updateThreadTitle, thread switching, deleteThread,
 * and auto-creation when no threads exist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Wire the localkit test double into the offlinekit import path.
const {
  app: mockApp,
  agentMemories: mockAgentMemories,
  agentConversations: mockAgentConversations,
} = vi.hoisted(() => {
  // Inline collection factory — mirrors localkit-double but avoids
  // import resolution issues in the hoisted context.
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = []

    function matchesFilter(doc: T, filter?: Partial<T>): boolean {
      if (!filter) return true
      return Object.entries(filter).every(([key, value]) => doc[key] === value)
    }

    return {
      findMany(filter?: Partial<T>): Promise<T[]> {
        const result = docs.filter(
          (d) => !(d as Record<string, unknown>)._deleted && matchesFilter(d, filter)
        )
        return Promise.resolve([...result])
      },
      create(data: Partial<T> & Record<string, unknown>): Promise<T> {
        const now = new Date().toISOString()
        const id = (data.id as string) ?? `${name}-${docs.length}`
        const doc = {
          ...data,
          id,
          _id: id,
          _collection: name,
          _updatedAt: now,
          _deleted: false,
        } as unknown as T
        docs.push(doc)
        return Promise.resolve(doc)
      },
      update(id: string, data: Partial<T>): Promise<T | null> {
        const idx = docs.findIndex(
          (d) => (d as Record<string, unknown>).id === id && !(d as Record<string, unknown>)._deleted
        )
        if (idx === -1) return Promise.resolve(null)
        const now = new Date().toISOString()
        docs[idx] = { ...docs[idx], ...data, _updatedAt: now } as T
        return Promise.resolve(docs[idx])
      },
      delete(id: string): Promise<boolean> {
        const idx = docs.findIndex(
          (d) => (d as Record<string, unknown>).id === id && !(d as Record<string, unknown>)._deleted
        )
        if (idx === -1) return Promise.resolve(false)
        const now = new Date().toISOString()
        docs[idx] = { ...docs[idx], _deleted: true, _updatedAt: now } as T
        return Promise.resolve(true)
      },
      _raw(): T[] {
        return docs
      },
      _reset(): void {
        docs = []
      },
    }
  }

  const clients = createCollection<Record<string, unknown>>('clients')
  const pets = createCollection<Record<string, unknown>>('pets')
  const services = createCollection<Record<string, unknown>>('services')
  const appointments = createCollection<Record<string, unknown>>('appointments')
  const businessProfile = createCollection<Record<string, unknown>>('businessProfile')
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes')
  const agentProfile = createCollection<Record<string, unknown>>('agentProfile')
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories')
  const agentConversations = createCollection<Record<string, unknown>>('agentConversations')

  const app = {
    clients, pets, services, appointments, businessProfile,
    agentNotes, agentProfile, agentMemories, agentConversations,
  }
  return { app, agentMemories, agentConversations }
})

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }))

// Reset hoisted collections between tests (the global afterEach resets localkit-double,
// but these are separate hoisted instances).
function resetHoisted() {
  for (const col of Object.values(mockApp)) {
    (col as { _reset(): void })._reset()
  }
}

// Helper: persist a message in agentConversations (mirrors what the chat engine does)
async function sendMessage(threadId: string, role: 'user' | 'agent', content: string) {
  const now = new Date().toISOString()
  await mockAgentConversations.create({
    id: crypto.randomUUID(),
    user_id: '00000000-0000-0000-0000-000000000000',
    channel: threadId,
    message_id: crypto.randomUUID(),
    role,
    content,
    timestamp: now,
    status: 'sent',
    context: null,
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 0,
    sync_operation: null,
  })
}

describe('Chat Thread Lifecycle', () => {
  beforeEach(() => {
    resetHoisted()
  })

  it('full lifecycle: create → message → title → switch → delete → auto-create', async () => {
    const {
      createThread,
      loadThreadMessages,
      listThreads,
      deriveTitle,
      updateThreadTitle,
      deleteThread,
    } = await import('@/lib/chat-threads')

    // ---------------------------------------------------------------
    // 1. createThread() stores a new thread in agentMemories
    // ---------------------------------------------------------------
    const threadA = await createThread()
    expect(threadA).toHaveProperty('id')
    expect(threadA.title).toBe('New conversation')
    expect(threadA.createdAt).toBeTruthy()
    expect(threadA.updatedAt).toBeTruthy()

    // Verify it was persisted as type 'chat-thread' in agentMemories
    const memories = await mockAgentMemories.findMany()
    const threadDoc = memories.find(
      (m) => m.type === 'chat-thread' && (m.payload as Record<string, unknown>).id === threadA.id
    )
    expect(threadDoc).toBeDefined()

    // ---------------------------------------------------------------
    // 2. loadThreadMessages() returns empty for a new thread
    // ---------------------------------------------------------------
    const emptyMessages = await loadThreadMessages(threadA.id)
    expect(emptyMessages).toEqual([])

    // ---------------------------------------------------------------
    // 3. Sending messages persists them with correct channel
    // ---------------------------------------------------------------
    await sendMessage(threadA.id, 'user', 'Can you reschedule my Tuesday appointment?')
    await sendMessage(threadA.id, 'agent', 'Sure! I can move it to Wednesday at 10am.')

    const messagesA = await loadThreadMessages(threadA.id)
    expect(messagesA).toHaveLength(2)
    expect(messagesA[0]!.role).toBe('user')
    expect(messagesA[0]!.content).toBe('Can you reschedule my Tuesday appointment?')
    expect(messagesA[1]!.role).toBe('assistant') // 'agent' role maps to 'assistant'
    expect(messagesA[1]!.content).toBe('Sure! I can move it to Wednesday at 10am.')

    // ---------------------------------------------------------------
    // 4. deriveTitle() truncates to 40 chars
    // ---------------------------------------------------------------
    const shortTitle = deriveTitle('Hello there')
    expect(shortTitle).toBe('Hello there')

    const longTitle = deriveTitle(
      'Can you reschedule my Tuesday appointment to Wednesday morning please?'
    )
    expect(longTitle).toHaveLength(40)
    expect(longTitle).toBe('Can you reschedule my Tuesday appoint...')

    // Multiline gets flattened
    const multiline = deriveTitle('Line one\nLine two')
    expect(multiline).toBe('Line one Line two')

    // ---------------------------------------------------------------
    // 5. updateThreadTitle() updates the thread's title
    // ---------------------------------------------------------------
    const derived = deriveTitle('Can you reschedule my Tuesday appointment?')
    await updateThreadTitle(threadA.id, derived)

    const threadsAfterRename = await listThreads()
    const renamedThread = threadsAfterRename.find((t) => t.id === threadA.id)
    expect(renamedThread).toBeDefined()
    expect(renamedThread!.title).toBe(derived)

    // ---------------------------------------------------------------
    // 6. Thread switching: second thread has its own messages
    // ---------------------------------------------------------------
    const threadB = await createThread('Weather check')
    await sendMessage(threadB.id, 'user', 'What is the weather tomorrow?')
    await sendMessage(threadB.id, 'agent', 'Tomorrow will be sunny, 72F.')

    // Thread B has its own 2 messages
    const messagesB = await loadThreadMessages(threadB.id)
    expect(messagesB).toHaveLength(2)
    expect(messagesB[0]!.content).toBe('What is the weather tomorrow?')

    // Thread A still has exactly its own 2 messages (no cross-contamination)
    const messagesAAgain = await loadThreadMessages(threadA.id)
    expect(messagesAAgain).toHaveLength(2)
    expect(messagesAAgain[0]!.content).toBe('Can you reschedule my Tuesday appointment?')

    // listThreads returns both
    const allThreads = await listThreads()
    expect(allThreads).toHaveLength(2)

    // ---------------------------------------------------------------
    // 7. deleteThread() removes thread AND its messages
    // ---------------------------------------------------------------
    await deleteThread(threadA.id)

    // Thread A no longer appears in the list
    const threadsAfterDelete = await listThreads()
    expect(threadsAfterDelete).toHaveLength(1)
    expect(threadsAfterDelete[0]!.id).toBe(threadB.id)

    // Thread A's messages are also gone
    const deletedMessages = await loadThreadMessages(threadA.id)
    expect(deletedMessages).toEqual([])

    // Thread B's messages are untouched
    const messagesBAfterDelete = await loadThreadMessages(threadB.id)
    expect(messagesBAfterDelete).toHaveLength(2)

    // ---------------------------------------------------------------
    // 8. Auto-creation: when all threads are gone, create a new one
    // ---------------------------------------------------------------
    await deleteThread(threadB.id)
    const empty = await listThreads()
    expect(empty).toHaveLength(0)

    // Simulate what ChatPage does: if no threads, auto-create one
    let threads = await listThreads()
    if (threads.length === 0) {
      await createThread()
      threads = await listThreads()
    }
    expect(threads).toHaveLength(1)
    expect(threads[0]!.title).toBe('New conversation')
  })

  it('loadThreadMessages respects limit and before options', async () => {
    const { createThread, loadThreadMessages } = await import('@/lib/chat-threads')

    const thread = await createThread()

    // Send 5 messages with staggered timestamps
    for (let i = 0; i < 5; i++) {
      const ts = new Date(Date.now() + i * 1000).toISOString()
      await mockAgentConversations.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: thread.id,
        message_id: crypto.randomUUID(),
        role: 'user',
        content: `Message ${i}`,
        timestamp: ts,
        status: 'sent',
        context: null,
        created_at: ts,
        updated_at: ts,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: null,
      })
    }

    // limit: 3 returns the last 3 messages
    const limited = await loadThreadMessages(thread.id, { limit: 3 })
    expect(limited).toHaveLength(3)
    expect(limited[0]!.content).toBe('Message 2')
    expect(limited[2]!.content).toBe('Message 4')

    // before: filter messages before a timestamp
    const allMessages = await loadThreadMessages(thread.id)
    const cutoff = allMessages[3]!.timestamp
    const before = await loadThreadMessages(thread.id, { before: cutoff })
    expect(before.length).toBe(3)
    expect(before.every((m) => m.timestamp < cutoff)).toBe(true)
  })

  it('updateThreadTitle is a no-op for nonexistent thread', async () => {
    const { updateThreadTitle, listThreads, createThread } = await import('@/lib/chat-threads')

    await createThread('Only thread')
    await updateThreadTitle('nonexistent-id', 'Ghost title')

    // Original thread is untouched
    const threads = await listThreads()
    expect(threads).toHaveLength(1)
    expect(threads[0]!.title).toBe('Only thread')
  })

  it('deleteThread is a no-op for nonexistent thread', async () => {
    const { deleteThread, listThreads, createThread } = await import('@/lib/chat-threads')

    await createThread('Survivor')
    await deleteThread('nonexistent-id')

    const threads = await listThreads()
    expect(threads).toHaveLength(1)
    expect(threads[0]!.title).toBe('Survivor')
  })

  it('listThreads sorts by updatedAt descending (most recent first)', async () => {
    const { createThread, updateThreadTitle, listThreads } = await import('@/lib/chat-threads')

    const old = await createThread('Old thread')
    // Small delay so timestamps differ
    await new Promise((r) => setTimeout(r, 10))
    const newer = await createThread('Newer thread')

    let threads = await listThreads()
    expect(threads[0]!.id).toBe(newer.id)

    // Update old thread's title — bumps its updatedAt
    await new Promise((r) => setTimeout(r, 10))
    await updateThreadTitle(old.id, 'Updated old thread')

    threads = await listThreads()
    expect(threads[0]!.id).toBe(old.id)
    expect(threads[0]!.title).toBe('Updated old thread')
  })
})
