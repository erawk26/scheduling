/**
 * MessageBridge — routes inbound platform messages through the agent engine
 * and dispatches outbound responses via platform adapters.
 */

import type { PlatformAdapter, NormalizedMessage, OutboundMessage } from './types';
import { app } from '@/lib/offlinekit';

const USER_ID = '00000000-0000-0000-0000-000000000000';

type ConversationEntry = {
  id: string;
  user_id: string;
  channel: string;
  message_id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  status: 'sent' | 'received' | 'pending' | 'error';
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: null;
  deleted_at: null;
  needs_sync: number;
  sync_operation: 'INSERT';
};

async function storeConversationEntry(
  channel: string,
  messageId: string,
  role: 'user' | 'agent',
  content: string
): Promise<void> {
  const now = new Date().toISOString();
  const entry: ConversationEntry = {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    channel,
    message_id: messageId,
    role,
    content,
    timestamp: now,
    status: 'sent',
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 1,
    sync_operation: 'INSERT',
  };
  await app.agentConversations.create(entry as Parameters<typeof app.agentConversations.create>[0]);
}

export class MessageBridge {
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor(adapters: PlatformAdapter[] = []) {
    for (const adapter of adapters) {
      this.adapters.set(adapter.platform, adapter);
    }
  }

  registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  getAdapter(platform: string): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  async handleInbound(
    platform: string,
    rawPayload: unknown
  ): Promise<{ response: string } | null> {
    const adapter = this.adapters.get(platform);
    if (!adapter) return null;

    const msg: NormalizedMessage | null = adapter.parseInbound(rawPayload);
    if (!msg) return null;

    const messageId = msg.id;
    const channel = platform;

    await storeConversationEntry(channel, messageId, 'user', msg.text);

    // Dynamically import to keep server-side only
    const { processMessage } = await import('@/lib/agent/skills/engine');
    const agentResponse = await processMessage(msg.text);

    await storeConversationEntry(channel, messageId, 'agent', agentResponse.content);

    return { response: agentResponse.content };
  }

  async sendOutbound(msg: OutboundMessage): Promise<boolean> {
    const adapter = this.adapters.get(msg.platform);
    if (!adapter) return false;
    return adapter.sendMessage(msg.recipientId, msg.text, msg.replyToId);
  }
}
