/**
 * Learn skill: Pattern detection + profile update suggestions.
 * Reads notes + profile, writes to agentProfile.
 */

import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/types';
import type { ContextProvider, NotesContext, ProfileContext } from '@/lib/agent/context';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getFourWeekRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 28);
  return { from: start.toISOString(), to: now.toISOString() };
}

function toAgentContext(notes: NotesContext, profile: ProfileContext): AgentContext {
  const notesText = notes.notes
    .map((n) => `[${n.date_ref ?? 'no date'}] ${n.summary}${n.content ? `: ${n.content}` : ''}`)
    .join('\n');

  const profileText = profile.sections
    .map((s) => `[${s.section_id}] ${JSON.stringify(s.content)}`)
    .join('\n');

  return {
    rawText: [
      notesText ? `Recent notes:\n${notesText}` : '',
      profileText ? `Current profile:\n${profileText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

type ProfileUpdate = {
  section_id: string;
  content: Record<string, unknown>;
};

function parseProfileUpdates(llmResponse: string): ProfileUpdate[] {
  const match = llmResponse.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) return parsed as ProfileUpdate[];
    return [];
  } catch {
    return [];
  }
}

const VALID_SECTION_IDS = new Set([
  'work-schedule', 'service-area', 'travel-rules', 'client-rules',
  'personal-commitments', 'business-rules', 'priorities',
]);

async function applyProfileUpdates(updates: ProfileUpdate[]): Promise<void> {
  const validUpdates = updates.filter((u) => VALID_SECTION_IDS.has(u.section_id));
  const existing = await app.agentProfile.findMany() as unknown as Array<{
    _id: string;
    id: string;
    section_id: string;
  }>;

  const now = new Date().toISOString();
  for (const update of validUpdates) {
    const found = existing.find((p) => p.section_id === update.section_id);
    if (found) {
      await app.agentProfile.update(found._id, {
        content: update.content,
        updated_at: now,
        needs_sync: 1,
        sync_operation: 'UPDATE',
      });
    } else {
      await app.agentProfile.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        section_id: update.section_id as Parameters<typeof app.agentProfile.create>[0]['section_id'],
        content: update.content,
        created_at: now,
        updated_at: now,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 1,
        sync_operation: 'INSERT',
      });
    }
  }
}

export const learnSkill: Skill = {
  name: 'learn',
  description: 'Detects patterns in notes and suggests or applies profile updates',
  tier: 'L1',
  contextRequirements: ['getNotesContext', 'getProfileContext'],
  writeActions: ['agentProfile'],
  piiLevel: 'anonymized',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const range = getFourWeekRange();
    const [notes, profile] = await Promise.all([
      contextProvider.getNotesContext(range),
      contextProvider.getProfileContext(),
    ]);

    const agentContext = toAgentContext(notes, profile);
    const systemPrompt = `You are a scheduling assistant that learns from patterns. Analyze the notes and current profile, detect scheduling patterns or preferences, and suggest profile updates.
If you identify clear updates, return a JSON array of profile updates in a code block, then explain your reasoning.
JSON format: [{"section_id":"<id>","content":{<key-value pairs>}}]
Valid section IDs: work-schedule, service-area, travel-rules, client-rules, personal-commitments, business-rules, priorities.
Only suggest updates you are confident about from the evidence.`;

    const messages = buildPrompt(
      { name: 'learn', systemPrompt, piiLevel: 'anonymized' },
      agentContext,
      userMessage
    );

    const response = await sendMessage(messages, options.openrouterOptions);
    const updates = parseProfileUpdates(response.content);
    if (updates.length > 0) {
      await applyProfileUpdates(updates);
    }

    return { response, skillName: 'learn' };
  },
};
