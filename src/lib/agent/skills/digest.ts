/**
 * Digest skill: weekly summary with pattern detection. No LLM call — digest is pre-formatted.
 */

import type { AgentResponse } from '@/lib/agent/types';
import type { ContextProvider } from '@/lib/agent/context';
import { generateWeeklyDigest } from '@/lib/agent/weekly-digest';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

const ZERO_USAGE: AgentResponse['usage'] = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

export const digestSkill: Skill = {
  name: 'digest',
  description: 'Generates a weekly digest with stats and detected scheduling patterns',
  tier: 'L0',
  contextRequirements: ['getScheduleContext'],
  writeActions: [],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    _userMessage: string,
    _options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const content = await generateWeeklyDigest(contextProvider);
    const response: AgentResponse = { content, usage: ZERO_USAGE };
    return { response, skillName: 'digest' };
  },
};
