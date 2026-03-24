/**
 * Skill execution engine.
 * Routes messages, assembles context, calls OpenRouter, stores conversations.
 * Processes one message at a time per user via a promise queue.
 */

import { app } from '@/lib/offlinekit';
import { StructuredContextProvider } from '@/lib/agent/context';
import { checkBudget, getMonthlyUsage, logUsage } from '@/lib/agent/token-budget';
import type { AgentResponse } from '@/lib/agent/types';
import { routeMessage } from './router';

const CHANNEL = 'default';
const USER_ID = 'local-user';

const contextProvider = new StructuredContextProvider();

// Simple per-user queue: one message processed at a time
let messageQueue: Promise<void> = Promise.resolve();

type ConversationEntry = {
  id: string;
  user_id: string;
  channel: string;
  message_id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  status: 'sent' | 'received' | 'pending' | 'error';
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: null;
  deleted_at: null;
  needs_sync: number;
  sync_operation: 'INSERT';
};

async function storeConversation(
  messageId: string,
  role: 'user' | 'agent',
  content: string,
  skillName?: string
): Promise<void> {
  const now = new Date().toISOString();
  const entry: ConversationEntry = {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    channel: CHANNEL,
    message_id: messageId,
    role,
    content,
    timestamp: now,
    status: 'sent',
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 1,
    sync_operation: 'INSERT',
  };

  // context is optional — attach skill metadata if available
  const withContext = skillName
    ? { ...entry, context: { skillName } }
    : entry;

  await app.agentConversations.create(withContext as Parameters<typeof app.agentConversations.create>[0]);
}

async function _processMessage(userMessage: string): Promise<AgentResponse> {
  const messageId = crypto.randomUUID();

  // Check token budget before calling LLM
  const monthlyUsage = await getMonthlyUsage(app);
  const budgetCheck = checkBudget(monthlyUsage);

  if (!budgetCheck.allowed) {
    const content = budgetCheck.warning ?? 'Monthly token budget exceeded.';
    await storeConversation(messageId, 'user', userMessage);
    await storeConversation(messageId, 'agent', content);
    return { content, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }

  // Route to skill or general conversation
  const skill = routeMessage(userMessage);
  await storeConversation(messageId, 'user', userMessage);

  let response: AgentResponse;
  let skillName = 'general';

  if (skill) {
    const result = await skill.execute(contextProvider, userMessage);
    response = result.response;
    skillName = result.skillName;
  } else {
    // General conversation — no skill matched
    const { sendMessage } = await import('@/lib/agent/openrouter-client');
    response = await sendMessage([
      {
        role: 'system',
        content: 'You are a helpful scheduling assistant for a mobile pet groomer. Answer concisely.',
      },
      { role: 'user', content: userMessage },
    ]);
  }

  // Store agent response and log token usage
  await Promise.all([
    storeConversation(messageId, 'agent', response.content, skillName),
    logUsage(response.usage.total_tokens, skillName, app),
  ]);

  // Prepend budget warning if approaching limit
  if (budgetCheck.warning) {
    response = { ...response, content: `${response.content}\n\n_${budgetCheck.warning}_` };
  }

  return response;
}

/**
 * Process a user message through the skill engine.
 * Queued to ensure one message is processed at a time.
 */
export async function processMessage(userMessage: string): Promise<AgentResponse> {
  return new Promise<AgentResponse>((resolve, reject) => {
    messageQueue = messageQueue.then(async () => {
      try {
        resolve(await _processMessage(userMessage));
      } catch (err) {
        reject(err);
      }
    });
  });
}
