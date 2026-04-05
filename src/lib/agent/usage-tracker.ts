/**
 * Usage tracking for the AI scheduling agent.
 * Stores and retrieves token and email usage per user from agentMemories.
 */

import { app } from '@/lib/offlinekit';
import type { TierConfig } from './tier';

type AgentMemoryDoc = {
  _deleted?: boolean;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function currentWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function getMonthlyUsage(userId: string): Promise<{ tokensUsed: number; emailsSent: number }> {
  const month = currentMonth();
  const week = currentWeek();
  const all = (await app.agentMemories.findMany()) as AgentMemoryDoc[];
  const userDocs = all.filter((doc) => !doc._deleted && doc.user_id === userId);

  const tokensUsed = userDocs
    .filter((doc) => doc.type === 'usage-log' && doc.payload?.month === month)
    .reduce((sum, doc) => sum + ((doc.payload?.tokens as number) ?? 0), 0);

  const emailsSent = userDocs.filter(
    (doc) => doc.type === 'email-log' && doc.payload?.week === week
  ).length;

  return { tokensUsed, emailsSent };
}

export async function isWithinBudget(userId: string, tier: TierConfig): Promise<boolean> {
  const { tokensUsed, emailsSent } = await getMonthlyUsage(userId);
  if (tokensUsed >= tier.maxTokensPerMonth) return false;
  if (tier.maxEmailsPerWeek !== -1 && emailsSent >= tier.maxEmailsPerWeek) return false;
  return true;
}

export async function logUsage(
  userId: string,
  tokens: number,
  type: 'chat' | 'schedule-build' | 'email'
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    tokens,
    type,
    month: currentMonth(),
  };
  if (type === 'email') {
    payload['week'] = currentWeek();
  }

  await app.agentMemories.create({
    id: crypto.randomUUID(),
    user_id: userId,
    type: type === 'email' ? 'email-log' : 'usage-log',
    payload,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}
