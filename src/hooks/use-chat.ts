'use client';

import { useState, useMemo } from 'react';
import { useCollection } from 'mpb-localkit/react';
import { app } from '@/lib/offlinekit';
import { extractNote } from '@/lib/agent/skills/note-extractor';

type MessageRole = 'user' | 'agent';

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status: 'sent' | 'received' | 'pending' | 'error';
};

const CHANNEL = 'main';

export function useChat() {
  const { data: allDocs } = useCollection(app.agentConversations);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const messages = useMemo<ChatMessage[]>(() => {
    if (!allDocs) return [];
    return (allDocs as Array<ChatMessage & { _deleted?: boolean; channel: string }>)
      .filter((d) => !d._deleted && d.channel === CHANNEL)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((d) => ({
        id: d.id,
        role: d.role,
        content: d.content,
        timestamp: d.timestamp,
        status: d.status,
      }));
  }, [allDocs]);

  async function sendMessage(text: string) {
    if (!text.trim() || isProcessing) return;

    const now = new Date().toISOString();
    const userMsgId = crypto.randomUUID();

    // Persist user message
    await app.agentConversations.create({
      id: userMsgId,
      user_id: 'local-user',
      channel: CHANNEL,
      message_id: userMsgId,
      role: 'user',
      content: text.trim(),
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
    });

    setIsProcessing(true);
    setStreamingContent('');

    let agentText = '';

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), conversationId: userMsgId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        agentText += chunk;
        setStreamingContent(agentText);
      }
    } catch {
      agentText = "I'm having trouble connecting right now. Please try again.";
    }

    // Persist agent response
    const agentMsgId = crypto.randomUUID();
    const agentNow = new Date().toISOString();
    await app.agentConversations.create({
      id: agentMsgId,
      user_id: 'local-user',
      channel: CHANNEL,
      message_id: agentMsgId,
      role: 'agent',
      content: agentText,
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
    });

    // Extract scheduling notes from agent response
    await extractNote(text, agentText).catch(() => undefined);

    setStreamingContent('');
    setIsProcessing(false);
  }

  return { messages, sendMessage, isProcessing, streamingContent };
}
