/**
 * Skill execution engine.
 * Routes messages, assembles context, calls OpenRouter, stores conversations.
 * Processes one message at a time per user via a promise queue.
 */

import { app } from '@/lib/offlinekit';
import { TieredContextProvider } from '@/lib/agent/context/tiered-provider';
import { AgentSearchIndex } from '@/lib/search/search-index';
import { checkBudget, getMonthlyUsage, logUsage } from '@/lib/agent/token-budget';
import type { AgentResponse } from '@/lib/agent/types';
import { routeMessage } from './router';
import { applyAction, type AdjustAction } from './adjust';

const CHANNEL = 'default';
const USER_ID = '00000000-0000-0000-0000-000000000000';

const searchIndex = new AgentSearchIndex();
const contextProvider = new TieredContextProvider(searchIndex);

// Simple per-user queue: one message processed at a time
let messageQueue: Promise<void> = Promise.resolve();

// Pending action awaiting user confirmation
let pendingAction: AdjustAction | null = null;
let pendingDescription: string = '';

const CONFIRM_RE = /^(yes|confirm|do it|go ahead|ok|sure|yep|yeah)\b/i;
const REJECT_RE = /^(no|cancel|never\s*mind|stop|don't|nah)\b/i;

function isConfirmation(msg: string): boolean {
  return CONFIRM_RE.test(msg.trim());
}

function isRejection(msg: string): boolean {
  return REJECT_RE.test(msg.trim());
}

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

async function handleConfirmation(
  userMessage: string,
  messageId: string,
): Promise<AgentResponse | null> {
  if (!pendingAction) return null;

  await storeConversation(messageId, 'user', userMessage);

  if (isConfirmation(userMessage)) {
    const action = pendingAction;
    pendingAction = null;
    pendingDescription = '';
    const result = await applyAction(action);
    const content = `Done! ${result}`;
    await storeConversation(messageId, 'agent', content, 'adjust');
    return { content, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }

  if (isRejection(userMessage)) {
    pendingAction = null;
    pendingDescription = '';
    const content = 'Got it — cancelled. No changes were made.';
    await storeConversation(messageId, 'agent', content, 'adjust');
    return { content, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }

  // Not a clear confirm/reject — clear pending and process normally
  pendingAction = null;
  pendingDescription = '';
  return null;
}

async function routeAndExecute(
  userMessage: string,
): Promise<{ response: AgentResponse; skillName: string }> {
  const skill = routeMessage(userMessage);

  if (skill) {
    const result = await skill.execute(contextProvider, userMessage);
    let response = result.response;
    const skillName = result.skillName;

    if (result.pendingAction) {
      pendingAction = result.pendingAction as AdjustAction;
      pendingDescription = response.content;
      response = {
        ...response,
        content: `${response.content}\n\nPlease confirm to proceed, or say "cancel" to discard.`,
      };
    }
    return { response, skillName };
  }

  const { sendMessage } = await import('@/lib/agent/openrouter-client');
  const response = await sendMessage([
    { role: 'system', content: 'You are a helpful scheduling assistant for a mobile pet groomer. Answer concisely.' },
    { role: 'user', content: userMessage },
  ]);
  return { response, skillName: 'general' };
}

async function _processMessage(userMessage: string): Promise<AgentResponse> {
  const messageId = crypto.randomUUID();

  const confirmResult = await handleConfirmation(userMessage, messageId);
  if (confirmResult) return confirmResult;

  const monthlyUsage = await getMonthlyUsage(app);
  const budgetCheck = checkBudget(monthlyUsage);

  if (!budgetCheck.allowed) {
    const content = budgetCheck.warning ?? 'Monthly token budget exceeded.';
    await storeConversation(messageId, 'user', userMessage);
    await storeConversation(messageId, 'agent', content);
    return { content, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }

  await storeConversation(messageId, 'user', userMessage);
  let { response, skillName } = await routeAndExecute(userMessage);

  await Promise.all([
    storeConversation(messageId, 'agent', response.content, skillName),
    logUsage(response.usage.total_tokens, skillName, app),
  ]);

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
