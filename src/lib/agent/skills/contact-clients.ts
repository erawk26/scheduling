/**
 * Contact-Clients skill: "Contact my clients" / "Send booking links"
 * L1 skill — reads draft schedule + client context, prepares outreach plan, stores in agentNotes.
 * Does NOT send emails directly — proposes outreach for user approval first.
 */

import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import type { ContextProvider, ScheduleContext, ClientContext, ClientSummary } from '@/lib/agent/context';
import type { ChatMessage } from '@/lib/agent/types';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getNextWeekRange(): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const mon = new Date(now);
  mon.setDate(now.getDate() + daysUntilNextMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

interface ClientOutreach {
  clientId: string;
  clientName: string;
  email: string;
  slots: string[];
}

function buildOutreachList(schedule: ScheduleContext, clients: ClientContext): ClientOutreach[] {
  const draftAppointments = schedule.appointments.filter((apt) => apt.status === 'draft');
  const clientByName = new Map<string, ClientSummary>(
    clients.clients.map((c) => [`${c.first_name} ${c.last_name}`, c])
  );

  const slotsByName = new Map<string, string[]>();
  for (const apt of draftAppointments) {
    const existing = slotsByName.get(apt.clientName) ?? [];
    existing.push(apt.start_time);
    slotsByName.set(apt.clientName, existing);
  }

  const seen = new Set<string>();
  const result: ClientOutreach[] = [];

  for (const apt of draftAppointments) {
    const client = clientByName.get(apt.clientName);
    if (!client?.email || seen.has(client.id)) continue;
    seen.add(client.id);
    result.push({
      clientId: client.id,
      clientName: apt.clientName,
      email: client.email,
      slots: slotsByName.get(apt.clientName) ?? [],
    });
  }

  return result;
}

function buildSystemPrompt(outreach: ClientOutreach[]): string {
  const clientLines = outreach
    .map(
      (c) =>
        `  - ${c.clientName} (${c.email}): proposed slots: ${c.slots.map((s) => s.slice(0, 16).replace('T', ' ')).join(', ')}`
    )
    .join('\n');

  return `You are a scheduling assistant for a mobile pet service professional.
The groomer wants to reach out to clients about upcoming draft appointments that need confirmation.

Clients needing outreach (${outreach.length} total):
${clientLines}

Write a brief, friendly summary the groomer can review before approving outreach.
Start with: "I'd like to reach out to these ${outreach.length} client${outreach.length === 1 ? '' : 's'} about confirming their appointments:"
Then list each client with their proposed time slots in a readable format.
End with: "Shall I send them booking links to confirm?"`;
}

async function saveOutreachPlan(outreach: ClientOutreach[], weekFrom: string): Promise<void> {
  const now = new Date().toISOString();
  await app.agentNotes.create({
    id: crypto.randomUUID(),
    user_id: '00000000-0000-0000-0000-000000000000',
    summary: `Outreach plan for week of ${weekFrom.slice(0, 10)}: ${outreach.length} client${outreach.length === 1 ? '' : 's'}`,
    content: JSON.stringify({ clients: outreach, weekFrom, status: 'pending-approval' }),
    tags: ['outreach-plan'],
    date_ref: weekFrom,
    client_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

export const contactClientsSkill: Skill = {
  name: 'contact-clients',
  description: 'Identifies clients needing confirmation and prepares outreach',
  tier: 'L1',
  contextRequirements: ['getScheduleContext', 'getClientContext'],
  writeActions: ['agentNotes'],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const weekRange = getNextWeekRange();
    const [schedule, clients] = await Promise.all([
      contextProvider.getScheduleContext(weekRange),
      contextProvider.getClientContext(),
    ]);

    const outreach = buildOutreachList(schedule, clients);

    if (outreach.length === 0) {
      return {
        response: {
          content:
            'No draft appointments found for next week that need client confirmation. Build a schedule first, then I can help you reach out.',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        },
        skillName: 'contact-clients',
      };
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(outreach) },
      { role: 'user', content: userMessage },
    ];

    const response = await sendMessage(messages, options.openrouterOptions);
    await saveOutreachPlan(outreach, weekRange.from);

    return { response, skillName: 'contact-clients' };
  },
};
