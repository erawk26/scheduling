/**
 * Chat thread management backed by OfflineKit agentMemories.
 * Each thread is a { type: 'chat-thread', payload: { id, title, createdAt, updatedAt } }.
 * Messages use the thread ID as the `channel` field in agentConversations.
 */

import { app } from '@/lib/offlinekit';

const USER_ID = '00000000-0000-0000-0000-000000000000';

export type ChatThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryDoc = {
  _id: string;
  _deleted?: boolean;
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

type ConvDoc = {
  _id: string;
  _deleted?: boolean;
  channel: string;
  role: string;
  content: string;
  timestamp: string;
};

export async function listThreads(): Promise<ChatThread[]> {
  const all = (await app.agentMemories.findMany()) as MemoryDoc[];
  return all
    .filter((d) => !d._deleted && d.type === 'chat-thread')
    .map((d) => ({
      id: d.payload.id as string,
      title: d.payload.title as string,
      createdAt: d.payload.createdAt as string,
      updatedAt: d.payload.updatedAt as string,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createThread(title?: string): Promise<ChatThread> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const thread: ChatThread = {
    id,
    title: title ?? 'New conversation',
    createdAt: now,
    updatedAt: now,
  };

  await app.agentMemories.create({
    id: crypto.randomUUID(),
    user_id: USER_ID,
    type: 'chat-thread',
    payload: { ...thread },
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  return thread;
}

export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  const all = (await app.agentMemories.findMany()) as MemoryDoc[];
  const doc = all.find(
    (d) => !d._deleted && d.type === 'chat-thread' && d.payload.id === threadId
  );
  if (!doc) return;

  await app.agentMemories.update(doc._id, {
    payload: { ...doc.payload, title, updatedAt: new Date().toISOString() },
  } as Record<string, unknown>);
}

export async function updateThreadTimestamp(threadId: string): Promise<void> {
  const all = (await app.agentMemories.findMany()) as MemoryDoc[];
  const doc = all.find(
    (d) => !d._deleted && d.type === 'chat-thread' && d.payload.id === threadId
  );
  if (!doc) return;

  await app.agentMemories.update(doc._id, {
    payload: { ...doc.payload, updatedAt: new Date().toISOString() },
  } as Record<string, unknown>);
}

export async function deleteThread(threadId: string): Promise<void> {
  // Delete thread metadata
  const all = (await app.agentMemories.findMany()) as MemoryDoc[];
  const doc = all.find(
    (d) => !d._deleted && d.type === 'chat-thread' && d.payload.id === threadId
  );
  if (doc) await app.agentMemories.delete(doc._id);

  // Delete all messages in that channel
  const convs = (await app.agentConversations.findMany()) as ConvDoc[];
  for (const conv of convs) {
    if (!conv._deleted && conv.channel === threadId) {
      await app.agentConversations.delete(conv._id);
    }
  }
}

export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export async function loadThreadMessages(
  threadId: string,
  options?: { limit?: number; before?: string }
): Promise<StoredMessage[]> {
  const allDocs = (await app.agentConversations.findMany()) as ConvDoc[];
  let filtered = allDocs
    .filter((d) => !d._deleted && d.channel === threadId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (options?.before) {
    filtered = filtered.filter((d) => d.timestamp < options.before!);
  }

  const limit = options?.limit ?? 50;
  const sliced = filtered.slice(-limit);

  return sliced.map((m) => ({
    id: m._id,
    role: m.role === 'agent' ? ('assistant' as const) : ('user' as const),
    content: m.content,
    timestamp: m.timestamp,
  }));
}

/**
 * Auto-title a thread from its first user message.
 * Truncates to 40 chars.
 */
export function deriveTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\n/g, ' ');
  return cleaned.length > 40 ? cleaned.slice(0, 37) + '...' : cleaned;
}
