import {
  AuiIf,
  ThreadPrimitive,
  MessagePrimitive,
  useMessage,
  useThreadRuntime,
} from '@assistant-ui/react';
import { Bot, User } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TypingIndicator } from './typing-indicator';
import { EnhancedComposer } from './enhanced-composer';
import { MessageTimestamp } from './message-timestamp';
import { NewMessageBadge } from './new-message-badge';
import { SchedulePreviewCard } from './schedule-preview-card';
import { parseScheduleAction } from '@/lib/agent/schedule-action-parser';

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
              <p className="text-sm font-medium text-foreground">How can I help with your schedule?</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Try: &ldquo;What appointments do I have this week?&rdquo; or &ldquo;Move Sarah to Tuesday&rdquo;
              </p>
            </div>
          </AuiIf>

          <ThreadPrimitive.Messages>
            {({ message }) => {
              if (message.role === 'user') return <UserMessage />;
              return <AssistantMessage />;
            }}
          </ThreadPrimitive.Messages>

          <AuiIf condition={(s) => {
            const count = s.thread.messages.length;
            if (count > prevMessageCountRef.current) {
              if (isScrolledUp) {
                setNewMessageCount((n) => n + (count - prevMessageCountRef.current));
              }
              prevMessageCountRef.current = count;
            }
            return s.thread.isRunning;
          }}>
            <TypingIndicator isTyping={true} />
          </AuiIf>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 pt-2">
            <EnhancedComposer />
            <p className="text-center text-xs text-muted-foreground mt-2">
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
  return (
    <MessagePrimitive.Root className={cn('flex items-end gap-2 flex-row')}>
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary flex-shrink-0">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      {/* Inner component placed inside MessagePrimitive.Root to access useMessage() */}
      <AssistantMessageInner />
    </MessagePrimitive.Root>
  );
}

/**
 * Renders assistant message content.
 * Must be a child of MessagePrimitive.Root to use useMessage().
 * Detects embedded <schedule-action> blocks and renders SchedulePreviewCard
 * alongside the clean message text.
 */
function AssistantMessageInner() {
  const message = useMessage();
  const threadRuntime = useThreadRuntime();
  const timestamp = new Date().toISOString();

  const textContent = (message.content as Array<{ type: string; text?: string }>)
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('');

  const { scheduleAction, cleanText } = parseScheduleAction(textContent);

  const handleAccept = useCallback(() => {
    threadRuntime.append({
      role: 'user',
      content: [{ type: 'text', text: 'Yes, please confirm that change.' }],
    });
  }, [threadRuntime]);

  const handleDecline = useCallback(() => {
    threadRuntime.append({
      role: 'user',
      content: [{ type: 'text', text: 'No, please cancel that change.' }],
    });
  }, [threadRuntime]);

  return (
    <div data-testid="assistant-message-root" className="flex flex-col gap-2 max-w-[75%] items-start">
      {/* Text bubble — show clean text (block stripped) when action detected, otherwise normal parts */}
      {(scheduleAction ? cleanText : textContent) && (
        <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-secondary text-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {scheduleAction ? cleanText : <MessagePrimitive.Parts />}
        </div>
      )}

      {/* Schedule change preview card */}
      {scheduleAction && (
        <SchedulePreviewCard
          action={scheduleAction.action}
          clientName={scheduleAction.clientName}
          serviceName={scheduleAction.serviceName}
          datetime={scheduleAction.datetime}
          beforeDatetime={scheduleAction.beforeDatetime}
          location={scheduleAction.location}
          swapWith={scheduleAction.swapWith}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}

      <MessageTimestamp timestamp={timestamp} />
    </div>
  );
}
