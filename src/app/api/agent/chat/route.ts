/**
 * POST /api/agent/chat
 *
 * Streaming chat endpoint. Receives plain messages from the ChatModelAdapter,
 * streams via AI SDK streamText + SSE.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { FREE_TIER } from '@/lib/agent/tier';

export const runtime = 'nodejs';
export const maxDuration = 30;

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
});

const BASE_SYSTEM_PROMPT =
  'You are a helpful scheduling assistant for a mobile service professional. Help them manage their appointments, clients, and schedule efficiently. Be concise and friendly.';

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI is not configured. Set OPENROUTER_API_KEY.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.json();
  const { messages, system } = body as {
    messages: Array<{ id?: string; role: string; content: string }>;
    system?: string;
  };

  const message = messages?.[messages.length - 1]?.content;
  if (!message) {
    return new Response(JSON.stringify({ error: 'No message provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = system || BASE_SYSTEM_PROMPT;

  const result = streamText({
    model: openrouter(FREE_TIER.model),
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
  });

  return result.toTextStreamResponse();
}
