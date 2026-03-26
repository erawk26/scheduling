/**
 * Skill router — maps user messages to the appropriate skill.
 * Returns null for general conversation (no specific skill matched).
 */

import type { Skill } from './types';
import { buildScheduleSkill } from './build-schedule';
import { checkInSkill } from './check-in';
import { adjustSkill } from './adjust';
import { learnSkill } from './learn';
import { reportSkill } from './report';

const ALL_SKILLS: Skill[] = [buildScheduleSkill, checkInSkill, adjustSkill, learnSkill, reportSkill];

type SkillPattern = {
  skill: Skill;
  patterns: RegExp[];
};

const SKILL_PATTERNS: SkillPattern[] = [
  {
    skill: buildScheduleSkill,
    patterns: [
      /\b(build|create|make|generate)\s+(a\s+)?(schedule|plan|week)/i,
      /\bplan\s+(my|the|this|next)\s+week/i,
      /\bschedule\s+(builder|building)/i,
    ],
  },
  {
    skill: adjustSkill,
    patterns: [
      /\b(move|reschedule|shift|change)\b.*(to|from)/i,
      /\b(cancel|remove|delete)\b.*(appointment|session|booking)/i,
      /\bcancel\s+\w+/i,              // "cancel Sarah", "cancel Mrs. Johnson"
      /\bmove\s+\w+/i,                // "move Sarah to Wednesday"
      /\breschedule\s+\w+/i,
    ],
  },
  {
    skill: reportSkill,
    patterns: [
      /\b(weekly|week)\s+(report|summary|recap|review)\b/i,
      /\bhow\s+(did|was)\s+(my|the)\s+week\b/i,
      /\b(last|past)\s+week\b/i,
      /\bsummar(y|ize)\b/i,
    ],
  },
  {
    skill: learnSkill,
    patterns: [
      /\b(learn|remember|update\s+my\s+profile|profile\s+update)\b/i,
      /\b(pattern|prefer|usual|typical|always|never)\b/i,
      /\bwhat\s+(do\s+you|have\s+you)\s+(know|learned)\b/i,
    ],
  },
  {
    skill: checkInSkill,
    patterns: [
      /\b(week|schedule|agenda|calendar)\b/i,
      /\bwhat\s*(\'?s|is|are)\s+(my|the|on)\b/i,
      /\b(today|tomorrow|this\s+week|upcoming)\b/i,
      /\bhow\s+does\s+(my|the)\s+(week|day)\b/i,
      /\bwhat('s| is) (coming|next|on my)/i,
    ],
  },
];

/**
 * Route a user message to the most appropriate skill.
 * Returns null if no skill matches (general conversation).
 *
 * Priority order: adjust > report > learn > check-in (most specific first).
 */
export function routeMessage(message: string): Skill | null {
  for (const { skill, patterns } of SKILL_PATTERNS) {
    if (patterns.some((p) => p.test(message))) {
      return skill;
    }
  }
  return null;
}

/** Return all registered skills (for UI or help text). */
export function getAllSkills(): Skill[] {
  return ALL_SKILLS;
}
