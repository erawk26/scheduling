/**
 * Assembles ChatMessage arrays for OpenRouter from a skill definition,
 * agent context, and user message. Applies PII minimization when required.
 */

import { minimizePII } from './pii-minimizer';
import type { ChatMessage, AgentContext, AgentSkillDef } from './types';

function serializeContext(context: AgentContext): string {
  const parts: string[] = [];

  if (context.businessProfile) {
    const bp = context.businessProfile;
    parts.push(
      `Business: ${bp.businessName ?? 'Unknown'} | Timezone: ${bp.timezone ?? 'UTC'} | Service area: ${bp.serviceAreaMiles ?? 0} miles`
    );
  }

  if (context.upcomingAppointments?.length) {
    parts.push('\nUpcoming appointments:');
    for (const appt of context.upcomingAppointments) {
      const addr = appt.address ? ` @ ${appt.address}` : '';
      parts.push(`  - ${appt.startTime}: ${appt.clientName} — ${appt.serviceName}${addr}`);
    }
  }

  if (context.clients?.length) {
    parts.push('\nClients:');
    for (const c of context.clients) {
      const addr = c.address ? ` (${c.address})` : '';
      const flex = c.flexibility ? ` [${c.flexibility}]` : '';
      parts.push(`  - ${c.name}${addr}${flex}`);
    }
  }

  if (context.rawText) {
    parts.push(`\nAdditional context:\n${context.rawText}`);
  }

  return parts.join('\n');
}

/**
 * Build the ChatMessage array for an OpenRouter request.
 *
 * @param skill - Skill definition with system prompt and PII level
 * @param context - Agent context from the ContextProvider
 * @param userMessage - The user's latest message
 * @returns Array of ChatMessage objects ready for sendMessage / sendMessageStream
 */
export function buildPrompt(
  skill: AgentSkillDef,
  context: AgentContext,
  userMessage: string
): ChatMessage[] {
  let contextText = serializeContext(context);

  if (skill.piiLevel === 'anonymized' && context.clients?.length) {
    const clientList = context.clients.map((c) => ({
      name: c.name,
      address: c.address,
    }));
    const { text } = minimizePII(contextText, clientList);
    contextText = text;
  }

  const systemContent = contextText.trim()
    ? `${skill.systemPrompt}\n\n--- Current context ---\n${contextText}`
    : skill.systemPrompt;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userMessage },
  ];
}
