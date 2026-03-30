/**
 * Pagination integration test for loadThreadMessages.
 *
 * Verifies pagination behavior with 100+ messages in a thread:
 * - Default (no options) returns last 50 messages
 * - limit=20 returns exactly 20 messages
 * - before option returns older messages than the cursor
 * - Messages are sorted ascending by timestamp
 * - No duplicates across paginated pages
 *
 * Uses the localkit test double to exercise real stateful CRUD in-memory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wire the test double into the offlinekit import path
const { app: mockApp } = vi.hoisted(() => {
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = [];
    return {
      findMany(): Promise<T[]> { return Promise.resolve([...docs]) },
      create(data: T): Promise<T> {
        const doc = {
          ...data,
          _id: (data as Record<string, unknown>).id ?? crypto.randomUUID(),
          _collection: name,
          _updatedAt: new Date().toISOString(),
          _deleted: false,
        } as T;
        docs.push(doc);
        return Promise.resolve(doc);
      },
      _reset(): void { docs = []; },
      _raw(): T[] { return [...docs]; },
    };
  }

  const agentConversations = createCollection<Record<string, unknown>>('agentConversations');
  const threads = createCollection<Record<string, unknown>>('agentMemories');

  const app = {
    agentConversations,
    agentMemories: threads, // alias used by chat-threads.ts
  };

  return { app };
});

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }));

describe('Pagination: loadThreadMessages', () => {
  const THREAD_ID = 'thread-pagination-test';

  beforeEach(async () => {
    mockApp.agentConversations._reset();
    mockApp.agentMemories._reset();

    // Create thread metadata
    await mockApp.agentMemories.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'chat-thread',
      payload: { id: THREAD_ID, title: 'Pagination Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    });
  });

  it('default (no options) returns last 50 messages', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    // Seed 100 messages with ascending timestamps
    const messages = Array.from({ length: 100 }, (_, i) => {
      const timestamp = new Date(Date.now() + i * 1000).toISOString();
      return { role: i % 2 === 0 ? 'user' : 'agent', content: `Message ${i + 1}`, timestamp };
    });

    for (const msg of messages) {
      await mockApp.agentConversations.create({
        _id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: THREAD_ID,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        created_at: msg.timestamp,
        updated_at: msg.timestamp,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: 'INSERT',
      });
    }

    const result = await loadThreadMessages(THREAD_ID);

    // Should return last 50 (messages 51-100)
    expect(result).toHaveLength(50);
    expect(result[0]!.content).toBe('Message 51'); // earliest of the last 50
    expect(result[49]!.content).toBe('Message 100'); // most recent
  });

  it('limit=20 returns exactly 20 messages', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    // Seed 100 messages
    const messages = Array.from({ length: 100 }, (_, i) => {
      const timestamp = new Date(Date.now() + i * 1000).toISOString();
      return { role: i % 2 === 0 ? 'user' : 'agent', content: `Msg ${i + 1}`, timestamp };
    });

    for (const msg of messages) {
      await mockApp.agentConversations.create({
        _id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: THREAD_ID,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        created_at: msg.timestamp,
        updated_at: msg.timestamp,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: 'INSERT',
      });
    }

    const result = await loadThreadMessages(THREAD_ID, { limit: 20 });

    expect(result).toHaveLength(20);
    // Should be last 20 messages (81-100)
    expect(result[0]!.content).toBe('Msg 81');
    expect(result[19]!.content).toBe('Msg 100');
  });

  it('before cursor returns messages older than cursor', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    // Seed 100 messages
    const timestamps = Array.from({ length: 100 }, (_, i) => new Date(Date.now() + i * 1000).toISOString());
    const messages = timestamps.map((ts, i) => ({ role: i % 2 === 0 ? 'user' : 'agent', content: `M${i + 1}`, timestamp: ts }));

    for (const msg of messages) {
      await mockApp.agentConversations.create({
        _id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: THREAD_ID,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        created_at: msg.timestamp,
        updated_at: msg.timestamp,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: 'INSERT',
      });
    }

    // Use cursor at message 75 (timestamp in the middle)
    const cursorTimestamp = timestamps[74]; // Message 75's timestamp
    const result = await loadThreadMessages(THREAD_ID, { limit: 20, before: cursorTimestamp });

    expect(result).toHaveLength(20);
    // All messages should be older than cursor (i.e., messages 55-74 from the last 20 of first 74)
    const expectedContents = Array.from({ length: 20 }, (_, i) => `M${55 + i}`);
    expect(result.map(r => r.content)).toEqual(expectedContents);
  });

  it('messages are sorted in ascending order (oldest first)', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    // Seed messages out of order by timestamp
    const unordered = [
      { role: 'user' as const, content: 'Z-last', timestamp: new Date(Date.now() + 5000).toISOString() },
      { role: 'user' as const, content: 'A-first', timestamp: new Date(Date.now()).toISOString() },
      { role: 'user' as const, content: 'M-middle', timestamp: new Date(Date.now() + 2500).toISOString() },
    ];

    for (const msg of unordered) {
      await mockApp.agentConversations.create({
        _id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: THREAD_ID,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        created_at: msg.timestamp,
        updated_at: msg.timestamp,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: 'INSERT',
      });
    }

    const result = await loadThreadMessages(THREAD_ID, { limit: 10 });

    // Should be sorted oldest first
    expect(result.map(r => r.content)).toEqual(['A-first', 'M-middle', 'Z-last']);
  });

  it('paginating does not produce duplicates across pages', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    // Seed 30 messages
    for (let i = 0; i < 30; i++) {
      const timestamp = new Date(Date.now() + i * 1000).toISOString();
      await mockApp.agentConversations.create({
        _id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: THREAD_ID,
        role: 'user',
        content: `Msg ${i + 1}`,
        timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: 'INSERT',
      });
    }

    // Page 1: last 10 messages (21-30)
    const page1 = await loadThreadMessages(THREAD_ID, { limit: 10 });
    expect(page1).toHaveLength(10);
    expect(page1[0]!.content).toBe('Msg 21');
    expect(page1[9]!.content).toBe('Msg 30');

    // Page 2: use before cursor from page1's oldest message (Msg 21)
    const cursor = page1[0]!.timestamp;
    const page2 = await loadThreadMessages(THREAD_ID, { limit: 10, before: cursor });

    expect(page2).toHaveLength(10);
    expect(page2.map(m => m.content)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Msg ${11 + i}`)
    );

    // Verify no overlap between pages
    const page1Contents = new Set(page1.map(m => m.content));
    const page2Contents = new Set(page2.map(m => m.content));
    expect([...page1Contents].filter(x => page2Contents.has(x))).toHaveLength(0);
  });

  it('handles empty thread gracefully', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    const result = await loadThreadMessages(THREAD_ID);

    expect(result).toEqual([]);
  });

  it('limit > available messages returns all available', async () => {
    const { loadThreadMessages } = await import('@/lib/chat-threads');

    // Only seed 10 messages
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(Date.now() + i * 1000).toISOString();
      await mockApp.agentConversations.create({
        _id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        channel: THREAD_ID,
        role: 'user',
        content: `Msg ${i + 1}`,
        timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: 'INSERT',
      });
    }

    const result = await loadThreadMessages(THREAD_ID, { limit: 50 });

    expect(result).toHaveLength(10); // All of them
  });
});
