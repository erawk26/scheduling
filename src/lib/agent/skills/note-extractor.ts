/**
 * Note extractor skill — runs after each agent response.
 * Detects scheduling intent and persists agentNotes to OfflineKit.
 */

import { app } from '@/lib/offlinekit';

const SCHEDULING_KEYWORDS = [
  'schedule', 'appointment', 'book', 'cancel', 'reschedule', 'move',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'next week', 'this week', 'tomorrow', 'today', 'morning', 'afternoon', 'evening',
  'confirm', 'available', 'slot', 'time', 'date',
];

function hasSchedulingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return SCHEDULING_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractTags(userMessage: string, agentResponse: string): string[] {
  const combined = `${userMessage} ${agentResponse}`.toLowerCase();
  const tags: string[] = [];

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
  // Prefer first sentence of agent response, truncated to ~120 chars
  const firstSentence = agentResponse.split(/[.!?]/)[0]?.trim() ?? '';
  if (firstSentence.length > 10) {
    return firstSentence.slice(0, 120);
  }
  return userMessage.slice(0, 120);
}

/**
 * Check if the exchange contains scheduling intent and persist a note if so.
 * Fire-and-forget from the chat flow.
 */
export async function extractNote(
  userMessage: string,
  agentResponse: string
): Promise<void> {
  if (!hasSchedulingIntent(userMessage) && !hasSchedulingIntent(agentResponse)) {
    return;
  }

  const now = new Date().toISOString();
  const tags = extractTags(userMessage, agentResponse);
  const summary = buildSummary(userMessage, agentResponse);

  await app.agentNotes.create({
    id: crypto.randomUUID(),
    user_id: 'local-user',
    summary,
    content: `User: ${userMessage}\n\nAgent: ${agentResponse}`,
    tags,
    date_ref: now,
    client_id: null,
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 0,
    sync_operation: null,
  });
}
