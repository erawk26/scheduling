'use client';

import {
  AuiIf,
  ComposerPrimitive,
  ThreadPrimitive,
  MessagePrimitive,
} from '@assistant-ui/react';
import { Bot, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
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
          {({ message }) => {
            if (message.role === 'user') return <UserMessage />;
            return <AssistantMessage />;
          }}
        </ThreadPrimitive.Messages>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 pt-2">
          <ComposerPrimitive.Root className="flex items-end gap-2 max-w-3xl mx-auto w-full border border-gray-200 bg-white rounded-2xl px-4 py-3">
            <ComposerPrimitive.Input
              placeholder="Message your AI scheduler..."
              className="flex-1 min-h-[44px] max-h-[160px] resize-none bg-transparent text-sm focus:outline-none"
              rows={1}
              autoFocus
            />
            <ComposerPrimitive.Send className="flex items-center justify-center h-11 w-11 rounded-full bg-primary text-primary-foreground disabled:opacity-30 flex-shrink-0">
              <Send className="w-4 h-4" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          <p className="text-center text-xs text-gray-400 mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className={cn('flex items-end gap-2 flex-row-reverse')}>
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white flex-shrink-0">
        <User className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-1 max-w-[75%] items-end">
        <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap">
          <MessagePrimitive.Parts />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className={cn('flex items-end gap-2 flex-row')}>
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 flex-shrink-0">
        <Bot className="w-4 h-4 text-gray-600" />
      </div>
      <div className="flex flex-col gap-1 max-w-[75%] items-start">
        <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
          <MessagePrimitive.Parts />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}
