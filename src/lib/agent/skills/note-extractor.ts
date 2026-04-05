/**
 * Note extractor skill — runs after each agent response.
 * Detects memory types and persists agentNotes to OfflineKit.
 */

import { app } from '@/lib/offlinekit';
import type { AgentSearchIndex } from '@/lib/search/search-index';

export type MemoryType = 'scheduling' | 'preference' | 'correction' | 'learned-fact';

const SCHEDULING_KEYWORDS = [
  'schedule', 'appointment', 'book', 'cancel', 'reschedule', 'move',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'next week', 'this week', 'tomorrow', 'this morning', 'this afternoon', 'this evening',
  'confirm', 'available', 'time slot', 'open slot',
];

const PREFERENCE_INDICATORS = [
  'prefer', 'like to', "don't like", 'always', 'never', 'usually',
  'i want', 'i need', "please don't", 'please always',
];

const CORRECTION_INDICATORS = [
  'no,', 'no that', 'actually', "that's wrong", 'not correct',
  'i meant', 'i said', 'correction',
];

const FACT_INDICATORS = [
  'did you know', 'fyi', 'by the way', 'remember that', 'note that',
  'keep in mind', 'important:', 'heads up',
];

function hasSchedulingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return SCHEDULING_KEYWORDS.some((kw) => lower.includes(kw));
}

export function detectMemoryTypes(userMessage: string, agentResponse: string): MemoryType[] {
  const types: MemoryType[] = [];
  const combined = `${userMessage} ${agentResponse}`.toLowerCase();
  const userLower = userMessage.toLowerCase();

  if (hasSchedulingIntent(combined)) types.push('scheduling');
  if (PREFERENCE_INDICATORS.some((p) => combined.includes(p))) types.push('preference');
  if (CORRECTION_INDICATORS.some((c) => userLower.includes(c))) types.push('correction');
  if (FACT_INDICATORS.some((f) => combined.includes(f))) types.push('learned-fact');

  return types;
}

function extractTags(userMessage: string, agentResponse: string, memTypes: MemoryType[]): string[] {
  const combined = `${userMessage} ${agentResponse}`.toLowerCase();
  const tags: string[] = memTypes.map((t) => `memory:${t}`);

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (combined.includes(day)) tags.push(day);
  }

  if (combined.includes('cancel')) tags.push('cancel');
  if (combined.includes('reschedule') || combined.includes('move')) tags.push('reschedule');
  if (combined.includes('book') || combined.includes('schedule') || combined.includes('appointment')) {
    tags.push('schedule');
  }
  if (combined.includes('confirm')) tags.push('confirm');

  return [...new Set(tags)];
}

function buildSummary(userMessage: string, agentResponse: string): string {
  const firstSentence = agentResponse.split(/[.!?]/)[0]?.trim() ?? '';
  if (firstSentence.length > 10) {
    return firstSentence.slice(0, 120);
  }
  return userMessage.slice(0, 120);
}

async function isDuplicate(summary: string): Promise<boolean> {
  const notes = await app.agentNotes.findMany() as Array<{ summary: string; created_at: string }>;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return notes.some((n) => {
    if (n.created_at < cutoff) return false;
    return n.summary === summary;
  });
}

/**
 * Detect memory types and persist a note if relevant.
 * Fire-and-forget from the chat flow — wraps errors silently.
 */
export async function extractNote(
  userMessage: string,
  agentResponse: string,
  searchIndex?: AgentSearchIndex
): Promise<void> {
  try {
    const memTypes = detectMemoryTypes(userMessage, agentResponse);
    if (memTypes.length === 0) return;

    const summary = buildSummary(userMessage, agentResponse);
    if (await isDuplicate(summary)) return;

    const now = new Date().toISOString();
    const tags = extractTags(userMessage, agentResponse, memTypes);
    const id = crypto.randomUUID();

    await app.agentNotes.create({
      id,
      user_id: '00000000-0000-0000-0000-000000000000',
      summary,
      content: `User: ${userMessage}\n\nAgent: ${agentResponse}`,
      tags,
      date_ref: now,
      client_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    if (searchIndex) {
      searchIndex.addDocuments('agentNotes', [{ id, collection: 'agentNotes', text: `${summary} ${userMessage}` }]);
    }
  } catch {
    // fire-and-forget — never surface errors to caller
  }
}
