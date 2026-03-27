/**
 * POST /api/agent/chat
 *
 * AI SDK v6-compatible streaming chat endpoint for assistant-ui.
 * Uses convertToModelMessages + streamText + toUIMessageStreamResponse.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
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
    messages: UIMessage[];
    system?: string;
  };

  // Use provided system prompt (from bootstrap or context injection), fall back to base
  const systemPrompt = system || BASE_SYSTEM_PROMPT;

  const result = streamText({
    model: openrouter(FREE_TIER.model),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
