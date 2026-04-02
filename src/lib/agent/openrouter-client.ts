/**
 * OpenRouter HTTP client for LLM inference.
 * Server-side only — uses OPENROUTER_API_KEY env var.
 */

import type { ChatMessage, AgentResponse, OpenRouterOptions } from './types';
import { FREE_TIER } from './tier';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? FREE_TIER.model;
const BUDGET_EXCEEDED_RESPONSE: AgentResponse = {
  content: "I've hit my thinking budget for the month. Upgrade to continue.",
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
};
const FAILURE_RESPONSE: AgentResponse = {
  content:
    "I'm having trouble thinking right now. I've saved your message and will process it when I'm back.",
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
};

function getHeaders(): Record<string, string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3025',
    'X-Title': 'KE Agenda AI Scheduler',
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMessage(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<AgentResponse> {
  if (
    options.tokensUsed !== undefined &&
    options.maxTokensPerMonth !== undefined &&
    options.tokensUsed >= options.maxTokensPerMonth
  ) {
    return BUDGET_EXCEEDED_RESPONSE;
  }

  const model = options.model ?? DEFAULT_MODEL;
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: options.maxTokens ?? 2000,
    temperature: options.temperature ?? 0.7,
    stream: false,
  });

  const delays: [number, number, number] = [1000, 2000, 4000];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: getHeaders(),
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`OpenRouter ${res.status}: ${text}`);
      }

      const json = await res.json();
      const content: string = json.choices?.[0]?.message?.content ?? '';
      const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      return { content, usage };
    } catch (err) {
      if (attempt < 2) {
        await sleep(delays[attempt as 0 | 1 | 2]);
      } else {
        console.error('[openrouter-client] Persistent failure after 3 attempts:', err);
      }
    }
  }

  return FAILURE_RESPONSE;
}

export function sendMessageStream(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): ReadableStream<Uint8Array> {
  if (
    options.tokensUsed !== undefined &&
    options.maxTokensPerMonth !== undefined &&
    options.tokensUsed >= options.maxTokensPerMonth
  ) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(BUDGET_EXCEEDED_RESPONSE.content));
        controller.close();
      },
    });
  }

  const model = options.model ?? DEFAULT_MODEL;
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: options.maxTokens ?? 2000,
    temperature: options.temperature ?? 0.7,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const delays: [number, number, number] = [1000, 2000, 4000];

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: getHeaders(),
            body,
          });

          if (!res.ok || !res.body) {
            const text = await res.text().catch(() => res.statusText);
            throw new Error(`OpenRouter ${res.status}: ${text}`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // Skip malformed SSE chunks
              }
            }
          }

          controller.close();
          return;
        } catch (err) {
          if (attempt < 2) {
            await sleep(delays[attempt as 0 | 1 | 2]);
          } else {
            console.error('[openrouter-client] Stream failure after 3 attempts:', err);
            controller.enqueue(
              encoder.encode(FAILURE_RESPONSE.content)
            );
            controller.close();
          }
        }
      }
    },
  });
}
