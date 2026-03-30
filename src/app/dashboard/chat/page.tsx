import { useEffect, useState, useCallback } from 'react';
import { Bot, WifiOff, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react';
import { Thread } from '@/components/assistant-ui/thread';
import { ThreadSidebar } from '@/components/assistant-ui/thread-sidebar';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { app } from '@/lib/offlinekit';
import { getMonthlyUsage, logUsage } from '@/lib/agent/token-budget';
import { FREE_TIER } from '@/lib/agent/tier';
import { TieredContextProvider } from '@/lib/agent/context/tiered-provider';
import { AgentSearchIndex } from '@/lib/search/search-index';
import {
  listThreads,
  createThread,
  deleteThread,
  loadThreadMessages,
  updateThreadTimestamp,
  updateThreadTitle,
  deriveTitle,
  type ChatThread,
} from '@/lib/chat-threads';
import { Button } from '@/components/ui/button';

const USER_ID = '00000000-0000-0000-0000-000000000000';
const searchIndex = new AgentSearchIndex();
const contextProvider = new TieredContextProvider(searchIndex);

type StoredMessageLike = { role: 'user' | 'assistant'; content: string };

// --- Chat Model Adapter factory: creates one per thread ---
export function createChatModelAdapter(threadId: string, onFirstMessage: (text: string) => void): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const userText = lastUserMsg?.content
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join(' ') ?? '';

      // Auto-title on first user message
      if (messages.filter((m) => m.role === 'user').length === 1 && userText) {
        onFirstMessage(userText);
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

      // Log token usage
      const estimatedTokens = Math.ceil((userText.length + fullText.length) / 4);
      logUsage(estimatedTokens, 'chat', app).catch(() => {});

      // Persist messages
      const now = new Date().toISOString();
      app.agentConversations.create({
        id: lastUserMsg?.id ?? crypto.randomUUID(),
        user_id: USER_ID,
        channel: threadId,
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

      const agentNow = new Date().toISOString();
      app.agentConversations.create({
        id: crypto.randomUUID(),
        user_id: USER_ID,
        channel: threadId,
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

      // Update thread timestamp
      updateThreadTimestamp(threadId).catch(() => {});
    },
  };
}

export default function ChatPage() {
  const { isOnline } = useNetworkStatus();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<StoredMessageLike[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load threads on mount
  useEffect(() => {
    async function init() {
      const existing = await listThreads();
      if (existing.length > 0) {
        setThreads(existing);
        const firstId = existing[0]!.id;
        setActiveThreadId(firstId);
        const msgs = await loadThreadMessages(firstId);
        setInitialMessages(msgs);
      } else {
        // Create first thread
        const thread = await createThread('New conversation');
        setThreads([thread]);
        setActiveThreadId(thread.id);
        setInitialMessages([]);
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleSelectThread = useCallback(async (id: string) => {
    setActiveThreadId(id);
    setInitialMessages(null);
    const msgs = await loadThreadMessages(id);
    setInitialMessages(msgs);
  }, []);

  const handleNewThread = useCallback(async () => {
    const thread = await createThread('New conversation');
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setInitialMessages([]);
  }, []);

  const handleDeleteThread = useCallback(async (id: string) => {
    await deleteThread(id);
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        const nextId = remaining[0]!.id;
        setActiveThreadId(nextId);
        const msgs = await loadThreadMessages(nextId);
        setInitialMessages(msgs);
      } else {
        const thread = await createThread('New conversation');
        setThreads([thread]);
        setActiveThreadId(thread.id);
        setInitialMessages([]);
      }
    }
  }, [activeThreadId, threads]);

  const handleFirstMessage = useCallback((text: string) => {
    if (!activeThreadId) return;
    const title = deriveTitle(text);
    updateThreadTitle(activeThreadId, title).catch(() => {});
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, title } : t))
    );
  }, [activeThreadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-sm text-gray-400">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 flex-shrink-0">
          <ThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex-shrink-0">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>You&rsquo;re offline — messages will be sent when you reconnect</span>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">AI Scheduler</h1>
            <p className="text-xs text-gray-500">Your scheduling assistant</p>
          </div>
          <div className="ml-auto">
            <TokenUsageWidget />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeThreadId && initialMessages !== null ? (
            <ThreadView
              key={activeThreadId}
              threadId={activeThreadId}
              initialMessages={initialMessages}
              onFirstMessage={handleFirstMessage}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadView({
  threadId,
  initialMessages,
  onFirstMessage,
}: {
  threadId: string;
  initialMessages: StoredMessageLike[];
  onFirstMessage: (text: string) => void;
}) {
  const adapter = createChatModelAdapter(threadId, onFirstMessage);
  const runtime = useLocalRuntime(adapter, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
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
    <div className="flex flex-col items-end gap-1 min-w-[100px]">
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
