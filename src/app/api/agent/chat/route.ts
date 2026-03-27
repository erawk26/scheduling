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

  // Bootstrap mode: use the bootstrap system prompt instead of normal context
  if (bootstrapPrompt) {
    const messages: ChatMessage[] = [
      { role: 'system', content: bootstrapPrompt },
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

  // Build system prompt with context from OfflineKit (sent by client)
  let systemPrompt =
    'You are a helpful scheduling assistant for a mobile service professional. Help them manage their appointments, clients, and schedule efficiently.';

  if (context) {
    const parts: string[] = [];

    if (context.profile && Array.isArray((context.profile as { sections?: unknown[] }).sections)) {
      const sections = (context.profile as { sections: Array<{ section_id: string; content: unknown }> }).sections;
      if (sections.length > 0) {
        parts.push('Business profile:');
        for (const s of sections) {
          parts.push(`  [${s.section_id}]: ${JSON.stringify(s.content)}`);
        }
      }
    }

    if (context.schedule) {
      const sched = context.schedule as { appointments?: Array<{ start_time: string; clientName: string; serviceName: string; address?: string | null }> };
      if (sched.appointments?.length) {
        parts.push('\nUpcoming appointments:');
        for (const a of sched.appointments) {
          const addr = a.address ? ` @ ${a.address}` : '';
          parts.push(`  - ${a.start_time}: ${a.clientName} — ${a.serviceName}${addr}`);
        }
      }
    }

    if (context.clients) {
      const cl = context.clients as { clients?: Array<{ first_name: string; last_name: string; address?: string | null; scheduling_flexibility?: string; pets?: Array<{ name: string; species: string; breed?: string | null }> }> };
      if (cl.clients?.length) {
        parts.push('\nClients:');
        for (const c of cl.clients) {
          const addr = c.address ? ` (${c.address})` : '';
          const flex = c.scheduling_flexibility ? ` [${c.scheduling_flexibility}]` : '';
          const petNames = c.pets?.map((p) => `${p.name} the ${p.breed ?? p.species}`).join(', ');
          const petStr = petNames ? ` — Pets: ${petNames}` : '';
          parts.push(`  - ${c.first_name} ${c.last_name}${addr}${flex}${petStr}`);
        }
      }
    }

    if (context.notes) {
      const n = context.notes as { notes?: Array<{ summary: string; date_ref?: string | null }> };
      if (n.notes?.length) {
        parts.push('\nNotes/memories:');
        for (const note of n.notes) {
          const date = note.date_ref ? ` (${note.date_ref})` : '';
          parts.push(`  - ${note.summary}${date}`);
        }
      }
    }

    if (parts.length > 0) {
      systemPrompt += '\n\n--- Current context ---\n' + parts.join('\n');
    }
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
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
