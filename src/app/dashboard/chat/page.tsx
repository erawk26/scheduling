'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/use-chat';
import { format } from 'date-fns';

export default function ChatPage() {
  const { messages, sendMessage, isProcessing, streamingContent } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages or streaming content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  function handleSend() {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    sendMessage(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  const hasMessages = messages.length > 0 || isProcessing;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">AI Scheduler</h1>
          <p className="text-xs text-gray-500">Your scheduling assistant</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-gray-700">How can I help with your schedule?</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Try: &ldquo;What appointments do I have this week?&rdquo; or &ldquo;Move Sarah to Tuesday&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
        ))}

        {/* Streaming in-progress bubble */}
        {isProcessing && (
          <MessageBubble
            role="agent"
            content={streamingContent}
            timestamp={new Date().toISOString()}
            isStreaming
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message your AI scheduler…"
            rows={1}
            disabled={isProcessing}
            className="resize-none min-h-[44px] max-h-[160px] flex-1"
            aria-label="Message input"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
};

function MessageBubble({ role, content, timestamp, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0',
          isUser ? 'bg-primary text-white' : 'bg-gray-100'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-gray-600" />}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-1 max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'bg-primary text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          )}
        >
          {content || (isStreaming ? <TypingDots /> : null)}
        </div>
        <span className="text-xs text-gray-400 px-1">
          {format(new Date(timestamp), 'h:mm a')}
        </span>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-0.5">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  );
}
