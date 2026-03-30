/**
 * Tier configuration for the AI scheduling agent.
 * Defines free/paid plan limits and model selection.
 */

import type { BusinessProfile } from '@/lib/offlinekit/schema';

export type TierConfig = {
  name: 'free' | 'paid';
  model: string;
  maxTokensPerMonth: number;
  maxEmailsPerWeek: number;
};

export const FREE_TIER: TierConfig = {
  name: 'free',
  model: 'openrouter/auto',
  maxTokensPerMonth: 50000,
  maxEmailsPerWeek: 10,
};

export const PAID_TIER: TierConfig = {
  name: 'paid',
  model: 'anthropic/claude-3.5-sonnet',
  maxTokensPerMonth: 500000,
  maxEmailsPerWeek: -1,
};

/**
 * Reads the user's tier from their business profile.
 * Defaults to FREE_TIER if no tier is set.
 */
export function getUserTier(businessProfile: BusinessProfile | null | undefined): TierConfig {
  const tier = (businessProfile as Record<string, unknown> | null | undefined)?.['tier'];
  return tier === 'paid' ? PAID_TIER : FREE_TIER;
}
