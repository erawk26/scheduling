/**
 * Streaming variant of the skill engine.
 * Routes messages through the skill router, gathers context,
 * and streams the response via sendMessageStream.
 * Logs token usage after the stream completes.
 */

import { app } from '@/lib/offlinekit';
import { StructuredContextProvider } from '@/lib/agent/context';
import { checkBudget, getMonthlyUsage, logUsage } from '@/lib/agent/token-budget';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import { sendMessageStream } from '@/lib/agent/openrouter-client';
import type { ChatMessage, AgentSkillDef } from '@/lib/agent/types';
import type { ContextProvider } from '@/lib/agent/context';
import { routeMessage } from './router';

const USER_ID = '00000000-0000-0000-0000-000000000000';
const CHANNEL = 'default';

const serverContextProvider = new StructuredContextProvider();

type ConversationEntry = {
  id: string;
  user_id: string;
  channel: string;
  message_id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  status: 'sent' | 'received' | 'pending' | 'error';
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: null;
  deleted_at: null;
  needs_sync: number;
  sync_operation: 'INSERT';
};

async function storeConversation(
  messageId: string,
  role: 'user' | 'agent',
  content: string,
  skillName?: string
): Promise<void> {
  const now = new Date().toISOString();
  const entry: ConversationEntry = {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    channel: CHANNEL,
    message_id: messageId,
    role,
    content,
    timestamp: now,
    status: 'sent',
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 1,
    sync_operation: 'INSERT',
  };

  const withContext = skillName
    ? { ...entry, context: { skillName } }
    : entry;

  await app.agentConversations.create(withContext as Parameters<typeof app.agentConversations.create>[0]);
}

/**
 * Get the skill system prompt definition for a matched skill.
 * We derive this from the skill's name and known prompt patterns,
 * falling back to a generic assistant prompt.
 */
const SKILL_PROMPTS: Record<string, string> = {
  'check-in':
    'You are a scheduling assistant for a mobile pet groomer. Give a concise, friendly overview of the week ahead based on the appointments and notes provided. Highlight any weather alerts or potential conflicts.',
  'build-schedule':
    'You are a scheduling assistant for a mobile pet groomer. Help build an optimized weekly schedule. Consider travel time between appointments, client flexibility, and weather conditions.',
  adjust:
    'You are a scheduling assistant for a mobile pet groomer. Help adjust the schedule by moving, rescheduling, or canceling appointments as requested.',
  learn:
    'You are a scheduling assistant for a mobile pet groomer. Learn and remember preferences, patterns, and important details about the business and clients.',
  report:
    'You are a scheduling assistant for a mobile pet groomer. Provide a concise weekly report summarizing completed appointments, revenue, and notable events.',
  digest:
    'You are a scheduling assistant for a mobile pet groomer. Provide a weekly digest highlighting patterns, trends, and actionable insights.',
  'contact-clients':
    'You are a scheduling assistant for a mobile pet groomer. Help compose and send messages to clients about appointments, confirmations, or scheduling changes.',
  'respond-integration':
    'You are a scheduling assistant for a mobile pet groomer. Help review and manage client responses, confirmations, and booking status updates.',
};

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful scheduling assistant for a mobile service professional. Help them manage their appointments, clients, and schedule efficiently.';

/**
 * Build chat messages for a skill-routed request.
 * Uses the skill's context requirements to gather server-side context,
 * then assembles the prompt via buildPrompt.
 */
async function buildSkillMessages(
  skillName: string,
  piiLevel: 'anonymized' | 'full',
  contextProvider: ContextProvider,
  userMessage: string
): Promise<ChatMessage[]> {
  const systemPrompt = SKILL_PROMPTS[skillName] ?? DEFAULT_SYSTEM_PROMPT;
  const skillDef: AgentSkillDef = { name: skillName, systemPrompt, piiLevel };

  // Gather full context from the provider
  const fullContext = await contextProvider.getFullContext(userMessage);

  // Convert to the AgentContext shape expected by buildPrompt
  const agentContext: import('@/lib/agent/types').AgentContext = {
    upcomingAppointments: fullContext.schedule?.appointments.map((apt) => ({
      id: apt.id,
      clientName: apt.clientName,
      serviceName: apt.serviceName,
      startTime: apt.start_time,
      address: apt.address ?? undefined,
    })),
    clients: fullContext.clients?.clients.map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      address: c.address ?? undefined,
      flexibility: c.scheduling_flexibility,
    })),
    businessProfile: fullContext.profile?.sections.length
      ? {
          businessName: fullContext.profile.sections.find((s) => s.section_id === 'business_info')?.content?.businessName as string | undefined,
          timezone: fullContext.profile.sections.find((s) => s.section_id === 'business_info')?.content?.timezone as string | undefined,
        }
      : undefined,
    rawText: fullContext.notes?.notes
      .map((n) => `[${n.date_ref ?? 'no date'}] ${n.summary}`)
      .join('\n') || undefined,
  };

  return buildPrompt(skillDef, agentContext, userMessage);
}

/**
 * Build chat messages using client-provided context (from the chat route body).
 * This mirrors the existing route.ts context formatting.
 */
function buildMessagesFromClientContext(
  systemPrompt: string,
  context: Record<string, unknown> | undefined,
  userMessage: string
): ChatMessage[] {
  let finalPrompt = systemPrompt;

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
      finalPrompt += '\n\n--- Current context ---\n' + parts.join('\n');
    }
  }

  return [
    { role: 'system', content: finalPrompt },
    { role: 'user', content: userMessage },
  ];
}

/**
 * Process a user message through the skill engine, returning a streaming response.
 *
 * - Routes the message to a skill via routeMessage()
 * - Checks the monthly token budget before calling the LLM
 * - Uses the skill's system prompt with gathered context
 * - Streams the response via sendMessageStream
 * - Logs token usage and stores conversation after the stream completes
 */
export function processMessageStream(
  userMessage: string,
  clientContext?: Record<string, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const messageId = crypto.randomUUID();
  const skill = routeMessage(userMessage);
  const skillName = skill?.name ?? 'general';

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Check token budget
        const monthlyUsage = await getMonthlyUsage(app);
        const budgetCheck = checkBudget(monthlyUsage);

        if (!budgetCheck.allowed) {
          const content = budgetCheck.warning ?? 'Monthly token budget exceeded.';
          await storeConversation(messageId, 'user', userMessage);
          await storeConversation(messageId, 'agent', content, skillName);
          controller.enqueue(encoder.encode(content));
          controller.close();
          return;
        }

        // Store user message
        await storeConversation(messageId, 'user', userMessage);

        // Build messages: use skill-specific prompt with context
        let messages: ChatMessage[];

        if (skill) {
          const systemPrompt = SKILL_PROMPTS[skill.name] ?? DEFAULT_SYSTEM_PROMPT;

          if (clientContext) {
            // Client sent context — use it directly with the skill's system prompt
            messages = buildMessagesFromClientContext(systemPrompt, clientContext, userMessage);
          } else {
            // No client context — gather from server-side provider
            messages = await buildSkillMessages(skill.name, skill.piiLevel, serverContextProvider, userMessage);
          }
        } else {
          // General conversation — no skill matched
          const systemPrompt = DEFAULT_SYSTEM_PROMPT;
          if (clientContext) {
            messages = buildMessagesFromClientContext(systemPrompt, clientContext, userMessage);
          } else {
            messages = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ];
          }
        }

        // Stream the LLM response
        const llmStream = sendMessageStream(messages);
        const reader = llmStream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
          controller.enqueue(value);
        }

        // Post-stream: store agent response and log usage
        // Estimate tokens from character count (rough: ~4 chars per token)
        const estimatedTokens = Math.ceil(fullResponse.length / 4);
        await Promise.all([
          storeConversation(messageId, 'agent', fullResponse, skillName),
          logUsage(estimatedTokens, skillName, app),
        ]);

        // Append budget warning if approaching limit
        if (budgetCheck.warning) {
          controller.enqueue(encoder.encode(`\n\n_${budgetCheck.warning}_`));
        }

        controller.close();
      } catch (err) {
        console.error('[engine-stream] Error processing message:', err);
        controller.enqueue(
          encoder.encode("I'm having trouble right now. Please try again in a moment.")
        );
        controller.close();
      }
    },
  });
}
