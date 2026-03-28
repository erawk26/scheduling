'use client';

import { useEffect, useState } from 'react';
import { Bot, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react';
import { Thread } from '@/components/assistant-ui/thread';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { app } from '@/lib/offlinekit';
import { getMonthlyUsage, logUsage } from '@/lib/agent/token-budget';
import { FREE_TIER } from '@/lib/agent/tier';
import { StructuredContextProvider } from '@/lib/agent/context';

const CHANNEL = 'main';
const USER_ID = '00000000-0000-0000-0000-000000000000';
const contextProvider = new StructuredContextProvider();

type StoredMessage = {
  _id: string;
  _deleted?: boolean;
  id: string;
  channel: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
};

// --- Clear all conversation history from OfflineKit ---
async function clearConversationHistory(): Promise<void> {
  type ConvDoc = { _id: string; _deleted?: boolean; channel: string };
  const allDocs = (await app.agentConversations.findMany()) as ConvDoc[];
  for (const doc of allDocs) {
    if (!doc._deleted && doc.channel === CHANNEL) {
      await app.agentConversations.delete(doc._id);
    }
  }
}

// --- Chat Model Adapter: streams from our API ---
const chatModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const userText = lastUserMsg?.content
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ') ?? '';

    // Handle /new and /clear commands
    if (userText.trim() === '/new' || userText.trim() === '/clear') {
      await clearConversationHistory();
      yield { content: [{ type: 'text' as const, text: 'Conversation cleared. Reloading...' }] };
      // Give the UI a moment to show the message, then reload
      setTimeout(() => window.location.reload(), 500);
      return;
    }

    // Build system prompt with context
    let system = 'You are a helpful scheduling assistant for a mobile service professional. Help them manage their appointments, clients, and schedule efficiently. Be concise and friendly.';

    if (userText) {
      const ctx = await contextProvider.getFullContext(userText).catch(() => null);
      if (ctx) {
        const parts: string[] = [];
        if (ctx.schedule?.appointments?.length) {
          parts.push('Upcoming appointments:');
          for (const a of ctx.schedule.appointments) {
            parts.push(`  - ${a.start_time}: ${a.clientName} — ${a.serviceName}`);
          }
        }
        if (ctx.clients?.clients?.length) {
          parts.push('Clients:');
          for (const c of ctx.clients.clients) {
            const addr = c.address ? ` (${c.address})` : '';
            parts.push(`  - ${c.first_name} ${c.last_name}${addr}`);
          }
        }
        if (ctx.profile?.sections?.length) {
          parts.push('Business profile:');
          for (const s of ctx.profile.sections) {
            parts.push(`  [${s.section_id}]: ${JSON.stringify(s.content)}`);
          }
        }
        if (parts.length > 0) {
          system += '\n\n--- Current context ---\n' + parts.join('\n');
        }
      }
    }

    const apiMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join(' ') ?? '',
    }));

    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, system }),
      signal: abortSignal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      yield { content: [{ type: 'text' as const, text: fullText }] };
    }

    // Log estimated token usage
    const estimatedTokens = Math.ceil((userText.length + fullText.length) / 4);
    logUsage(estimatedTokens, 'chat', app).catch(() => {});

    // Persist user message
    const now = new Date().toISOString();
    app.agentConversations.create({
      id: lastUserMsg?.id ?? crypto.randomUUID(),
      user_id: USER_ID,
      channel: CHANNEL,
      message_id: lastUserMsg?.id ?? crypto.randomUUID(),
      role: 'user',
      content: userText,
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
    }).catch(() => {});

    // Persist agent response
    const agentNow = new Date().toISOString();
    app.agentConversations.create({
      id: crypto.randomUUID(),
      user_id: USER_ID,
      channel: CHANNEL,
      message_id: crypto.randomUUID(),
      role: 'agent',
      content: fullText,
      timestamp: agentNow,
      status: 'received',
      context: null,
      created_at: agentNow,
      updated_at: agentNow,
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    }).catch(() => {});
  },
};

// Load stored messages from OfflineKit
async function loadStoredMessages(): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const allDocs = (await app.agentConversations.findMany()) as StoredMessage[];
    return allDocs
      .filter((d) => !d._deleted && d.channel === CHANNEL)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((m) => ({
        role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));
  } catch {
    return [];
  }
}

export default function ChatPage() {
  const { isOnline } = useNetworkStatus();
  const [initialMessages, setInitialMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }> | null>(null);

  useEffect(() => {
    loadStoredMessages().then(setInitialMessages);
  }, []);

  // Don't render the runtime until initial messages are loaded
  if (initialMessages === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-sm text-gray-400">Loading chat...</div>
      </div>
    );
  }

  return <ChatPageInner isOnline={isOnline} initialMessages={initialMessages} />;
}

function ChatPageInner({ isOnline, initialMessages }: { isOnline: boolean; initialMessages: Array<{ role: 'user' | 'assistant'; content: string }> }) {
  const runtime = useLocalRuntime(chatModelAdapter, {
    initialMessages,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex-shrink-0">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>You&rsquo;re offline — messages will be sent when you reconnect</span>
          </div>
        )}

        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">AI Scheduler</h1>
            <p className="text-xs text-gray-500">Your scheduling assistant</p>
          </div>
          <div className="ml-auto">
            <TokenUsageWidget />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

function TokenUsageWidget() {
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const limit = FREE_TIER.maxTokensPerMonth;

  useEffect(() => {
    getMonthlyUsage(app).then(setTokensUsed).catch(() => setTokensUsed(0));
  }, []);

  if (tokensUsed === null) return null;

  const ratio = tokensUsed / limit;
  const isRed = ratio >= 0.95;
  const isAmber = ratio >= 0.8;

  function formatTokens(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  }

  return (
    <div className="flex flex-col items-end gap-1 min-w-[120px]">
      <span
        className={cn(
          'text-xs font-medium tabular-nums',
          isRed ? 'text-red-600' : isAmber ? 'text-amber-600' : 'text-gray-400'
        )}
      >
        {formatTokens(tokensUsed)} / {formatTokens(limit)} tokens
      </span>
      <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isRed ? 'bg-red-500' : isAmber ? 'bg-amber-400' : 'bg-primary/40'
          )}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
