import type { AgentResponse, OpenRouterOptions } from '@/lib/agent/types';
import type { ContextProvider } from '@/lib/agent/context';

export type SkillTier = 'L0' | 'L1' | 'L2';
export type SkillPIILevel = 'anonymized' | 'full';

export interface SkillResult {
  response: AgentResponse;
  skillName: string;
}

export interface SkillExecuteOptions {
  openrouterOptions?: OpenRouterOptions;
}

export interface Skill {
  /** Unique identifier for routing */
  name: string;
  /** Human-readable description */
  description: string;
  /** Complexity tier: L0 = read-only/fast, L1 = writes 1 collection, L2 = multi-write */
  tier: SkillTier;
  /** Which ContextProvider methods this skill calls */
  contextRequirements: string[];
  /** Collections this skill may write to */
  writeActions: string[];
  /** Whether to anonymize PII before sending to LLM */
  piiLevel: SkillPIILevel;
  execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options?: SkillExecuteOptions
  ): Promise<SkillResult>;
}
