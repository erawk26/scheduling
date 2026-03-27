/**
 * POST /api/agent/chat
 *
 * Receives a user message and streams the agent response.
 * Body: { message: string, conversationId?: string, context?: Record<string, unknown>, bootstrapPrompt?: string }
 *
 * Normal messages are routed through the skill engine (router + budget + logging).
 * Bootstrap messages bypass the engine and stream directly.
 */

import { NextRequest } from 'next/server';
import { sendMessageStream } from '@/lib/agent/openrouter-client';
import { processMessageStream } from '@/lib/agent/skills/engine-stream';
import type { ChatMessage } from '@/lib/agent/types';

export const runtime = 'nodejs';

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

export async function POST(request: NextRequest) {
  let body: { message?: string; conversationId?: string; context?: Record<string, unknown>; bootstrapPrompt?: string };

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

  // Guard: return a graceful plain-text response when the API key is missing
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      'AI is not configured yet. Set the OPENROUTER_API_KEY environment variable to enable the AI scheduler.',
      {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }

  const { context, bootstrapPrompt } = body;

  // Bootstrap mode: use the bootstrap system prompt directly, skip skill engine
  if (bootstrapPrompt) {
    const messages: ChatMessage[] = [
      { role: 'system', content: bootstrapPrompt },
      { role: 'user', content: message },
    ];

    const stream = sendMessageStream(messages);
    return new Response(stream, { headers: STREAM_HEADERS });
  }

  // Normal mode: route through the skill engine (skill detection, budget, logging)
  const stream = processMessageStream(message, context);
  return new Response(stream, { headers: STREAM_HEADERS });
}
