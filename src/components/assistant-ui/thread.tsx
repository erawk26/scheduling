import {
  AuiIf,
  ThreadPrimitive,
  MessagePrimitive,
  useAuiState,
} from '@assistant-ui/react';
import { Bot, User } from 'lucide-react';
import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TypingIndicator } from './typing-indicator';
import { EnhancedComposer } from './enhanced-composer';
import { MessageTimestamp } from './message-timestamp';
import { NewMessageBadge } from './new-message-badge';

export function Thread() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevMessageCountRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom) {
      setIsScrolledUp(false);
      setNewMessageCount(0);
    } else {
      setIsScrolledUp(true);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setIsScrolledUp(false);
    setNewMessageCount(0);
  }, []);

  const messagesLength = useAuiState((s) => s.thread.messages.length);
  useEffect(() => {
    if (messagesLength > prevMessageCountRef.current) {
      if (isScrolledUp) {
        setNewMessageCount((n) => n + (messagesLength - prevMessageCountRef.current));
      }
      prevMessageCountRef.current = messagesLength;
    }
  }, [messagesLength, isScrolledUp]);

  const renderMessage = useCallback(({ message }: { message: { role: string } }) => {
    if (message.role === 'user') return <UserMessage />;
    return <AssistantMessage />;
  }, []);

  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <ThreadPrimitive.Viewport
          ref={viewportRef}
          onScroll={handleScroll}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
        >
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-gray-700">How can I help with your schedule?</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Try: &ldquo;What appointments do I have this week?&rdquo; or &ldquo;Move Sarah to Tuesday&rdquo;
              </p>
            </div>
          </AuiIf>

          <ThreadPrimitive.Messages>
            {renderMessage}
          </ThreadPrimitive.Messages>

          <AuiIf condition={(s) => s.thread.isRunning}>
            <TypingIndicator isTyping={true} />
          </AuiIf>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 pt-2">
            <EnhancedComposer />
            <p className="text-center text-xs text-gray-400 mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>

        <NewMessageBadge
          visible={isScrolledUp && newMessageCount > 0}
          onClick={scrollToBottom}
          count={newMessageCount}
        />
      </div>
    </ThreadPrimitive.Root>
  );
}

function UserMessage() {
  const timestamp = new Date().toISOString();
  return (
    <MessagePrimitive.Root className={cn('flex items-end gap-2 flex-row-reverse')}>
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white flex-shrink-0">
        <User className="w-4 h-4" />
      </div>
      <div data-testid="user-message-root" className="flex flex-col gap-1 max-w-[75%] items-end">
        <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap">
          <MessagePrimitive.Parts />
        </div>
        <MessageTimestamp timestamp={timestamp} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  const timestamp = new Date().toISOString();
  return (
    <MessagePrimitive.Root className={cn('flex items-end gap-2 flex-row')}>
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 flex-shrink-0">
        <Bot className="w-4 h-4 text-gray-600" />
      </div>
      <div data-testid="assistant-message-root" className="flex flex-col gap-1 max-w-[75%] items-start">
        <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
          <MessagePrimitive.Parts />
        </div>
        <MessageTimestamp timestamp={timestamp} />
      </div>
    </MessagePrimitive.Root>
  );
}
