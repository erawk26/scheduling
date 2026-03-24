/**
 * POST /api/agent/chat
 *
 * Receives a user message and streams the agent response.
 * Body: { message: string, conversationId?: string }
 */

import { NextRequest } from 'next/server';
import { sendMessageStream } from '@/lib/agent/openrouter-client';
import type { ChatMessage } from '@/lib/agent/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { message?: string; conversationId?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // TODO: Wire up skill engine (task #3) — for now pass directly to OpenRouter
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a helpful scheduling assistant for a mobile service professional. Help them manage their appointments, clients, and schedule efficiently.',
    },
    { role: 'user', content: message },
  ];

  const stream = sendMessageStream(messages);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
