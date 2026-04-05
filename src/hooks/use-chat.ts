import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useCollection } from '@erawk26/localkit/react';
import { app } from '@/lib/offlinekit';
import { extractNote } from '@/lib/agent/skills/note-extractor';
import { StructuredContextProvider } from '@/lib/agent/context';
import {
  getBootstrapState,
  saveBootstrapAnswer,
  buildBootstrapSystemPrompt,
  type BootstrapState,
} from '@/lib/agent/bootstrap';

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
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const contextProvider = useRef(new StructuredContextProvider());
  const bootstrapChecked = useRef(false);

  // Check bootstrap on mount
  useEffect(() => {
    if (bootstrapChecked.current) return;
    bootstrapChecked.current = true;
    getBootstrapState().then(setBootstrapState).catch(() => {});
  }, []);

  // Auto-trigger bootstrap greeting on first load if not bootstrapped
  useEffect(() => {
    if (!bootstrapState?.isBootstrapping) return;
    if (bootstrapState.currentStep !== 0) return;
    // Only trigger if there are no existing messages (truly first time)
    if (optimisticMessages.length > 0) return;

    const hasPersistedMessages = allDocs && (allDocs as unknown[]).length > 0;
    if (hasPersistedMessages) return;

    // Send the bootstrap greeting as an agent message
    const greetingId = crypto.randomUUID();
    const now = new Date().toISOString();
    const greeting: ChatMessage = {
      id: greetingId,
      role: 'agent',
      content: "Hey! I'm your scheduling assistant. Let's get you set up — it'll only take a minute.\n\nWhat should I call you?",
      timestamp: now,
      status: 'received',
    };
    setOptimisticMessages([greeting]);

    // Persist greeting
    app.agentConversations.create({
      id: greetingId,
      user_id: '00000000-0000-0000-0000-000000000000',
      channel: CHANNEL,
      message_id: greetingId,
      role: 'agent',
      content: greeting.content,
      timestamp: now,
      status: 'received',
      context: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }).catch(() => {});
  }, [bootstrapState, allDocs, optimisticMessages.length]);

  // Merge persisted messages from OfflineKit with optimistic local messages
  const persistedMessages = useMemo<ChatMessage[]>(() => {
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

  const messages = useMemo<ChatMessage[]>(() => {
    const persistedIds = new Set(persistedMessages.map((m) => m.id));
    const pending = optimisticMessages.filter((m) => !persistedIds.has(m.id));
    return [...persistedMessages, ...pending].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
  }, [persistedMessages, optimisticMessages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const now = new Date().toISOString();
    const userMsgId = crypto.randomUUID();

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text.trim(),
      timestamp: now,
      status: 'sent',
    };

    // Show user message immediately
    setOptimisticMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    setStreamingContent('');

    // Persist in background
    app.agentConversations.create({
      id: userMsgId,
      user_id: '00000000-0000-0000-0000-000000000000',
      channel: CHANNEL,
      message_id: userMsgId,
      role: 'user',
      content: text.trim(),
      timestamp: now,
      status: 'sent',
      context: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }).catch(() => {});

    let agentText = '';

    try {
      // Check if we're in bootstrap mode
      const bState = bootstrapState ?? await getBootstrapState().catch(() => null);

      if (bState?.isBootstrapping) {
        // Save the user's answer for the current step
        await saveBootstrapAnswer(bState.currentStep, text.trim());

        // Get the next step
        const nextState = await getBootstrapState();
        setBootstrapState(nextState);

        if (nextState.isBootstrapping && nextState.currentPrompt) {
          // More questions — ask the LLM to pose the next one naturally
          const bootstrapPrompt = buildBootstrapSystemPrompt(nextState.currentStep);
          const res = await fetch('/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text.trim(),
              bootstrapPrompt,
            }),
          });

          if (res.ok && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              agentText += decoder.decode(value, { stream: true });
              setStreamingContent(agentText);
            }
          }
        } else {
          // Bootstrap complete!
          agentText = "You're all set! I've saved your preferences. Now I can help you manage your schedule, clients, and appointments. What would you like to do?";
        }
      } else {
        // Normal mode — gather context and chat
        const agentContext = await contextProvider.current
          .getFullContext(text.trim())
          .catch(() => null);

        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            conversationId: userMsgId,
            context: agentContext ?? undefined,
          }),
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
      }
    } catch {
      agentText = "I'm having trouble connecting right now. Please try again.";
    }

    // Create agent response and show it optimistically
    const agentMsgId = crypto.randomUUID();
    const agentNow = new Date().toISOString();

    const agentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: agentText,
      timestamp: agentNow,
      status: 'received',
    };

    setOptimisticMessages((prev) => [...prev, agentMsg]);
    setStreamingContent('');
    setIsProcessing(false);

    // Persist agent response in background
    app.agentConversations.create({
      id: agentMsgId,
      user_id: '00000000-0000-0000-0000-000000000000',
      channel: CHANNEL,
      message_id: agentMsgId,
      role: 'agent',
      content: agentText,
      timestamp: agentNow,
      status: 'received',
      context: null,
      created_at: agentNow,
      updated_at: agentNow,
      deleted_at: null,
    }).catch(() => {});

    // Extract scheduling notes (skip during bootstrap)
    if (!bootstrapState?.isBootstrapping) {
      extractNote(text, agentText).catch(() => undefined);
    }
  }, [isProcessing, bootstrapState]);

  return { messages, sendMessage, isProcessing, streamingContent };
}
