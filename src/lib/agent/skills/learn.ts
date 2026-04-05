/**
 * Learn skill: Pattern detection + profile update suggestions.
 * Reads notes + profile, writes to agentProfile.
 */

import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/context/types';
import type { ContextProvider } from '@/lib/agent/context';
import type { Appointment, Client } from '@/lib/offlinekit/schema';
import { detectPatterns } from '@/lib/agent/pattern-detector';
import type { DetectedPattern } from '@/lib/agent/pattern-detector';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getFourWeekRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 28);
  return { from: start.toISOString(), to: now.toISOString() };
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

async function storeConfirmedPatterns(
  patterns: DetectedPattern[],
  updates: ProfileUpdate[]
): Promise<void> {
  const updatedSections = new Set(updates.map((u) => u.section_id));
  const confirmed = patterns.filter((p) => updatedSections.has(p.affectedProfileSection));
  if (confirmed.length === 0) return;

  const now = new Date().toISOString();
  await Promise.all(
    confirmed.map((p) =>
      app.agentMemories.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        type: 'confirmed-pattern',
        payload: {
          patternType: p.type,
          description: p.description,
          suggestion: p.suggestion,
          confidence: p.confidence,
          affectedProfileSection: p.affectedProfileSection,
        },
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
    )
  );
}

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
      });
    } else {
      await app.agentProfile.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        section_id: update.section_id as Parameters<typeof app.agentProfile.create>[0]['section_id'],
        content: update.content,
        created_at: now,
        updated_at: now,
        deleted_at: null,
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
    const [notes, profile, rawApts, allClients] = await Promise.all([
      contextProvider.getNotesContext(range),
      contextProvider.getProfileContext(),
      app.appointments.findMany() as unknown as Appointment[],
      app.clients.findMany() as unknown as Client[],
    ]);

    const clientNames = new Map<string, string>(
      allClients.map((c) => [c.id, `${c.first_name} ${c.last_name}`])
    );
    const patterns = detectPatterns(rawApts, 4, clientNames);

    const patternNotes = patterns.map((p, i) => ({
      id: `pattern-${i}`,
      summary: `[${p.type}] ${p.description} (confidence: ${(p.confidence * 100).toFixed(0)}%) → ${p.suggestion}`,
      content: null,
      tags: ['detected-pattern'],
      date_ref: null,
      client_id: null,
    }));
    const agentContext: AgentContext = {
      query: userMessage,
      notes: { notes: [...notes.notes, ...patternNotes] },
      profile,
    };
    const systemPrompt = `You are a scheduling assistant that learns from patterns. Analyze the notes, current profile, and any detected patterns, then suggest profile updates.
If you identify clear updates, return a JSON array of profile updates in a code block, then explain your reasoning.
JSON format: [{"section_id":"<id>","content":{<key-value pairs>}}]
Valid section IDs: work-schedule, service-area, travel-rules, client-rules, personal-commitments, business-rules, priorities.
Only suggest updates you are confident about from the evidence. Detected patterns are pre-validated and trustworthy.`;

    const messages = buildPrompt(
      { name: 'learn', systemPrompt, piiLevel: 'anonymized' },
      agentContext,
      userMessage
    );

    const response = await sendMessage(messages, options.openrouterOptions);
    const updates = parseProfileUpdates(response.content);
    if (updates.length > 0) {
      await Promise.all([
        applyProfileUpdates(updates),
        storeConfirmedPatterns(patterns, updates),
      ]);
    }

    return { response, skillName: 'learn' };
  },
};
