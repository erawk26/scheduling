/**
 * INT-009: Token budget enforcement integration test.
 *
 * Verifies that the engine respects monthly token budget:
 * - When usage < limit (e.g., 80%), engine proceeds normally and calls LLM
 * - When usage >= 95% of maxTokensPerMonth, engine returns budget-exceeded message
 *
 * Uses the localkit test double with seeded usage-log entries in agentMemories.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wire the test double into the offlinekit import path
const { app: mockApp } = vi.hoisted(() => {
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = [];
    return {
      findMany(): Promise<T[]> { return Promise.resolve([...docs]); },
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
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories');
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes');
  const agentProfile = createCollection<Record<string, unknown>>('agentProfile');
  const clients = createCollection<Record<string, unknown>>('clients');
  const services = createCollection<Record<string, unknown>>('services');
  const appointments = createCollection<Record<string, unknown>>('appointments');
  const businessProfile = createCollection<Record<string, unknown>>('businessProfile');

  const app = {
    agentConversations,
    agentMemories,
    agentNotes,
    agentProfile,
    clients,
    services,
    appointments,
    businessProfile,
  };

  return { app };
});

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }));

// Mock search index and tiered context provider
vi.mock('@/lib/search/search-index', () => ({
  AgentSearchIndex: class {
    addDocuments = vi.fn();
    search = vi.fn().mockReturnValue([]);
  },
}));

vi.mock('@/lib/agent/context/tiered-provider', () => ({
  TieredContextProvider: class {
    getFullContext = vi.fn().mockResolvedValue({ query: '', profile: {}, schedule: { appointments: [] } });
  },
}));

// Mock openrouter-client
vi.mock('@/lib/agent/openrouter-client', () => ({
  sendMessage: vi.fn().mockResolvedValue({
    content: 'This is a generic response',
    usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
  }),
}));

// Mock router to return null (general conversation path)
vi.mock('@/lib/agent/skills/router', () => ({
  routeMessage: vi.fn().mockReturnValue(null),
}));

describe('Token Budget Enforcement Integration', () => {
  beforeEach(async () => {
    mockApp.agentConversations._reset();
    mockApp.agentMemories._reset();
    mockApp.agentNotes._reset();
    mockApp.agentProfile._reset();
    mockApp.clients._reset();
    mockApp.services._reset();
    mockApp.appointments._reset();
    mockApp.businessProfile._reset();
  });

  it('allows requests when usage is below limit (e.g., 80%)', async () => {
    // Seed usage log with 80,000 tokens for current month (80% of 100,000)
    const currentMonth = new Date().toISOString().slice(0, 7);
    await mockApp.agentMemories.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'usage-log',
      payload: { tokens: 80000, skill: 'general', month: currentMonth },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    });

    const { processMessage } = await import('@/lib/agent/skills/engine');

    const result = await processMessage('Hello, what can you do?');

    // Should succeed and contain response from openrouter-client, plus budget warning
    expect(result.content).toContain('This is a generic response');
    expect(result.content).toContain('running low on my monthly thinking budget');
    expect(result.usage.total_tokens).toBe(100);
  });

  it('blocks requests when usage >= 95% of limit', async () => {
    // Seed usage log with 96,000 tokens (96% of 100,000)
    const currentMonth = new Date().toISOString().slice(0, 7);
    await mockApp.agentMemories.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'usage-log',
      payload: { tokens: 96000, skill: 'general', month: currentMonth },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    });

    const { processMessage } = await import('@/lib/agent/skills/engine');

    const result = await processMessage('Hello, what can you do?');

    // Should return budget exceeded message without calling LLM
    expect(result.content).toMatch(/budget|thinking.*month/i);
    expect(result.usage.total_tokens).toBe(0);
  });

  it('logs usage after successful request', async () => {
    // Zero usage initially
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { processMessage } = await import('@/lib/agent/skills/engine');

    const result = await processMessage('Test message');

    expect(result.content).toBe('This is a generic response');

    // Verify usage was logged
    const usageLogs = mockApp.agentMemories._raw().filter(
      (doc) => doc.type === 'usage-log' && doc.payload.month === currentMonth
    );
    expect(usageLogs.length).toBeGreaterThanOrEqual(1);
    const totalLogged = usageLogs.reduce((sum, doc) => sum + ((doc.payload.tokens as number) ?? 0), 0);
    expect(totalLogged).toBeGreaterThan(0);
  });

  it('does not log usage when budget exceeded', async () => {
    // 96% usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    await mockApp.agentMemories.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'usage-log',
      payload: { tokens: 96000, skill: 'general', month: currentMonth },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    });

    const { processMessage } = await import('@/lib/agent/skills/engine');

    const usageBefore = mockApp.agentMemories._raw().filter(
      (doc) => doc.type === 'usage-log' && doc.payload.month === currentMonth
    ).length;

    const result = await processMessage('Hello');

    expect(result.content).toMatch(/budget/i);

    // No additional usage log should be created
    const usageAfter = mockApp.agentMemories._raw().filter(
      (doc) => doc.type === 'usage-log' && doc.payload.month === currentMonth
    ).length;
    expect(usageAfter).toBe(usageBefore);
  });
});
