'use client';

import { useEffect, useState } from 'react';
import { Bot, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useChatRuntime, AssistantChatTransport } from '@assistant-ui/react-ai-sdk';
import { Thread } from '@/components/assistant-ui/thread';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { app } from '@/lib/offlinekit';
import { getMonthlyUsage } from '@/lib/agent/token-budget';
import { FREE_TIER } from '@/lib/agent/tier';

export default function ChatPage() {
  const { isOnline } = useNetworkStatus();

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: '/api/agent/chat',
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex-shrink-0">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>You&rsquo;re offline — messages will be sent when you reconnect</span>
          </div>
        )}

        {/* Header */}
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

        {/* Thread */}
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
    getMonthlyUsage(app).then(setTokensUsed).catch(() => setTokensUsed(null));
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
