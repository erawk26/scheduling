// Shared types for the AI scheduling agent module

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type AgentResponse = {
  content: string;
  usage: TokenUsage;
};

export type OpenRouterOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Pre-computed monthly token usage for budget enforcement */
  tokensUsed?: number;
  /** Tier monthly token cap; if tokensUsed >= this, request is blocked */
  maxTokensPerMonth?: number;
};

// Internal flat context shape used only by buildPrompt serialization
export type PromptContext = {
  upcomingAppointments?: Array<{
    id: string;
    clientName: string;
    serviceName: string;
    startTime: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }>;
  clients?: Array<{
    id: string;
    name: string;
    address?: string;
    flexibility?: string;
  }>;
  businessProfile?: {
    businessName?: string;
    timezone?: string;
    serviceAreaMiles?: number;
  };
  rawText?: string;
};

export type PIILevel = 'anonymized' | 'full';

export type AgentSkillDef = {
  name: string;
  systemPrompt: string;
  piiLevel: PIILevel;
};
