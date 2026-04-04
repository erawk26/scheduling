/**
 * Assembles ChatMessage arrays for OpenRouter from a skill definition,
 * agent context, and user message. Applies PII minimization when required.
 */

import { parseISO, format, isBefore, startOfDay } from 'date-fns';
import { minimizePII } from './pii-minimizer';
import type { ChatMessage, AgentSkillDef } from './types';
import type { AgentContext } from './context/types';
import type { AppointmentSummary } from './context/types';

function groupByDay(appointments: AppointmentSummary[]): Map<string, AppointmentSummary[]> {
  const grouped = new Map<string, AppointmentSummary[]>();
  for (const appt of appointments) {
    const dateKey = appt.start_time.slice(0, 10);
    const list = grouped.get(dateKey) ?? [];
    list.push(appt);
    grouped.set(dateKey, list);
  }
  return grouped;
}

function serializeContext(context: AgentContext): string {
  const parts: string[] = [];

  if (context.profile?.sections.length) {
    parts.push('Business profile:');
    for (const section of context.profile.sections) {
      const content = section.content;
      const entries = Object.entries(content)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      parts.push(`  [${section.section_id}] ${entries}`);
    }
  }

  if (context.schedule?.appointments.length) {
    parts.push('\nAppointments:');
    const grouped = groupByDay(context.schedule.appointments);
    const today = startOfDay(new Date());
    for (const [dateKey, appts] of grouped) {
      const date = parseISO(dateKey);
      const past = isBefore(date, today);
      const dayLabel = format(date, 'EEEE, MMMM d');
      parts.push(`\n${dayLabel}${past ? ' (past)' : ''}:`);
      for (const appt of appts) {
        const time = format(parseISO(appt.start_time), 'h:mm a');
        const addr = appt.address ? ` @ ${appt.address}` : '';
        parts.push(`  ${time} — ${appt.clientName} — ${appt.serviceName} [${appt.status}] (id: ${appt.id})${addr}`);
      }
    }
  }

  if (context.clients?.clients.length) {
    parts.push('\nClients:');
    for (const c of context.clients.clients) {
      const addr = c.address ? ` (${c.address})` : '';
      const flex = c.scheduling_flexibility ? ` [${c.scheduling_flexibility}]` : '';
      const petNames = c.pets.map((p) => `${p.name} the ${p.breed ?? p.species}`).join(', ');
      const petStr = petNames ? ` — Pets: ${petNames}` : '';
      parts.push(`  - ${c.first_name} ${c.last_name}${addr}${flex}${petStr}`);
    }
  }

  if (context.notes?.notes.length) {
    parts.push('\nNotes/memories:');
    for (const note of context.notes.notes) {
      const date = note.date_ref ? ` (${note.date_ref})` : '';
      parts.push(`  - ${note.summary}${date}`);
    }
  }

  return parts.join('\n');
}

/**
 * Build the ChatMessage array for an OpenRouter request.
 *
 * @param skill - Skill definition with system prompt and PII level
 * @param context - Agent context from the ContextProvider (canonical rich type)
 * @param userMessage - The user's latest message
 * @returns Array of ChatMessage objects ready for sendMessage / sendMessageStream
 */
export function buildPrompt(
  skill: AgentSkillDef,
  context: AgentContext,
  userMessage: string
): ChatMessage[] {
  let contextText = serializeContext(context);

  if (skill.piiLevel === 'anonymized' && context.clients?.clients.length) {
    const clientList = context.clients.clients.map((c) => ({
      name: `${c.first_name} ${c.last_name}`,
      address: c.address ?? undefined,
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
