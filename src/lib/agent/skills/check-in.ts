/**
 * Check-in skill: "What's my week looking like?"
 * Reads schedule + notes for the current week.
 */

import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/types';
import type { ContextProvider, ScheduleContext, NotesContext } from '@/lib/agent/context';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

function toAgentContext(schedule: ScheduleContext, notes: NotesContext): AgentContext {
  const rawNotes = notes.notes
    .map((n) => `[${n.date_ref ?? 'no date'}] ${n.summary}`)
    .join('\n');

  return {
    upcomingAppointments: schedule.appointments.map((apt) => ({
      id: apt.id,
      clientName: apt.clientName,
      serviceName: apt.serviceName,
      startTime: apt.start_time,
      address: apt.address ?? undefined,
    })),
    rawText: rawNotes || undefined,
  };
}

export const checkInSkill: Skill = {
  name: 'check-in',
  description: 'Summarizes the current week schedule with relevant notes',
  tier: 'L0',
  contextRequirements: ['getScheduleContext', 'getNotesContext'],
  writeActions: [],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const range = getWeekRange();
    const [schedule, notes] = await Promise.all([
      contextProvider.getScheduleContext(range),
      contextProvider.getNotesContext(range),
    ]);

    const agentContext = toAgentContext(schedule, notes);
    const messages = buildPrompt(
      {
        name: 'check-in',
        systemPrompt:
          'You are a scheduling assistant for a mobile pet groomer. Give a concise, friendly overview of the week ahead based on the appointments and notes provided. Highlight any weather alerts or potential conflicts.',
        piiLevel: 'full',
      },
      agentContext,
      userMessage
    );

    const response = await sendMessage(messages, options.openrouterOptions);
    return { response, skillName: 'check-in' };
  },
};
