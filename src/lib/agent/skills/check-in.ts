/**
 * Check-in skill: "What's my week looking like?"
 * Reads schedule + notes for the current week.
 */

import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/context/types';
import type { ContextProvider } from '@/lib/agent/context';
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

    const agentContext: AgentContext = { query: userMessage, schedule, notes };
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
