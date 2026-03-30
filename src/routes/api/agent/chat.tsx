/**
 * POST /api/agent/chat
 *
 * Streaming chat endpoint. Receives plain messages from the ChatModelAdapter,
 * streams via AI SDK streamText + SSE.
 */

import { createFileRoute } from '@tanstack/react-router'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { FREE_TIER } from '@/lib/agent/tier'

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
})

const BASE_SYSTEM_PROMPT =
  'You are a helpful scheduling assistant for a mobile service professional. Help them manage their appointments, clients, and schedule efficiently. Be concise and friendly.'

export const Route = createFileRoute('/api/agent/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.OPENROUTER_API_KEY) {
          return new Response(
            JSON.stringify({ error: 'AI is not configured. Set OPENROUTER_API_KEY.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Test mode: return mock response if header present
        const testResponse = request.headers.get('X-Test-Response')
        if (testResponse) {
          const encoder = new TextEncoder()
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode(testResponse))
              controller.close()
            },
          })
          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { messages, system } = body as {
          messages?: Array<{ id?: string; role: string; content: string }>
          system?: string
        }

        if (!messages || !Array.isArray(messages)) {
          return new Response(JSON.stringify({ error: 'No message provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const message = messages[messages.length - 1]?.content
        if (!message) {
          return new Response(JSON.stringify({ error: 'No message provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const systemPrompt = system || BASE_SYSTEM_PROMPT

        const result = streamText({
          model: openrouter(FREE_TIER.model),
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        })

        return result.toTextStreamResponse()
      },
    },
  },
})
