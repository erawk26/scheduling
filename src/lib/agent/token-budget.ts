/**
 * Token budget management for the AI scheduling agent.
 * Tracks per-request limits and monthly caps stored in agentMemories.
 */

import type { app as OfflineKitAppInstance } from '@/lib/offlinekit';

export type OfflineKitApp = typeof OfflineKitAppInstance;

export type TokenBudgetConfig = {
  monthlyLimit: number;
  warningThreshold: 0.8;
  hardStopThreshold: 0.95;
  perRequestDefault: 2000;
  perScheduleBuild: 4000;
};

export const DEFAULT_BUDGET_CONFIG: TokenBudgetConfig = {
  monthlyLimit: 100000,
  warningThreshold: 0.8,
  hardStopThreshold: 0.95,
  perRequestDefault: 2000,
  perScheduleBuild: 4000,
};

export type BudgetCheckResult = {
  allowed: boolean;
  remaining: number;
  warning?: string;
};

/**
 * Check whether a request consuming `usage` tokens is within budget.
 */
export function checkBudget(
  currentMonthlyUsage: number,
  config: TokenBudgetConfig = DEFAULT_BUDGET_CONFIG
): BudgetCheckResult {
  const { monthlyLimit, warningThreshold, hardStopThreshold } = config;
  const ratio = currentMonthlyUsage / monthlyLimit;
  const remaining = monthlyLimit - currentMonthlyUsage;

  if (ratio >= hardStopThreshold) {
    return {
      allowed: false,
      remaining: Math.max(0, remaining),
      warning: "I've hit my thinking budget for the month. Please check back next month.",
    };
  }

  if (ratio >= warningThreshold) {
    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      warning: `I'm running low on my monthly thinking budget (${Math.round(ratio * 100)}% used).`,
    };
  }

  return { allowed: true, remaining: Math.max(0, remaining) };
}

/**
 * Log token usage for a request to the agentMemories collection.
 */
export async function logUsage(
  tokens: number,
  skill: string,
  app: OfflineKitApp
): Promise<void> {
  const now = new Date().toISOString();
  await app.agentMemories.create({
    id: crypto.randomUUID(),
    user_id: '00000000-0000-0000-0000-000000000000',
    type: 'usage-log',
    payload: {
      tokens,
      skill,
      month: now.slice(0, 7), // "YYYY-MM"
    },
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

type AgentMemoryDoc = {
  _deleted?: boolean;
  type: string;
  payload: Record<string, unknown>;
};

/**
 * Sum all usage-log entries for the current calendar month.
 */
export async function getMonthlyUsage(app: OfflineKitApp): Promise<number> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const all = (await app.agentMemories.findMany()) as AgentMemoryDoc[];

  return all
    .filter(
      (doc) =>
        !doc._deleted &&
        doc.type === 'usage-log' &&
        doc.payload?.month === currentMonth
    )
    .reduce((sum, doc) => sum + ((doc.payload?.tokens as number) ?? 0), 0);
}
