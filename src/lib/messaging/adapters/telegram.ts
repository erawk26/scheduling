/**
 * Telegram Bot API Adapter
 *
 * Implements PlatformAdapter for the Telegram Bot API.
 * Handles inbound webhook updates, outbound message formatting,
 * and direct message sending with rate-limit retry.
 */

import type { NormalizedMessage, OutboundMessage, PlatformAdapter } from '../types';
export type { NormalizedMessage, OutboundMessage, PlatformAdapter } from '../types';

// ---------------------------------------------------------------------------
// Telegram-specific types
// ---------------------------------------------------------------------------

interface TelegramFrom {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramFrom;
  chat: TelegramChat;
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramSendMessagePayload {
  chat_id: string | number;
  text: string;
  parse_mode?: string;
  reply_to_message_id?: number;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
  parameters?: { retry_after?: number };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class TelegramAdapter implements PlatformAdapter {
  readonly platform = 'telegram';
  private readonly botToken: string;

  constructor(botToken?: string) {
    const token = botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
    if (!token) {
      console.warn('[TelegramAdapter] No bot token provided — send operations will fail');
    }
    this.botToken = token;
  }

  parseInbound(raw: unknown): NormalizedMessage | null {
    if (!raw || typeof raw !== 'object') return null;

    const update = raw as TelegramUpdate;
    const msg = update.message;

    if (!msg || typeof msg.text !== 'string' || !msg.from) return null;

    const { from, chat, message_id, text, date } = msg;
    const senderName = [from.first_name, from.last_name].filter(Boolean).join(' ');

    return {
      id: String(message_id),
      platform: 'telegram',
      senderId: String(from.id),
      senderName,
      text,
      timestamp: new Date(date * 1000).toISOString(),
      metadata: { chatId: String(chat.id), raw },
    };
  }

  formatOutbound(msg: OutboundMessage): TelegramSendMessagePayload {
    const payload: TelegramSendMessagePayload = {
      chat_id: msg.recipientId,
      text: msg.text,
      parse_mode: 'HTML',
    };
    if (msg.replyToId) {
      payload.reply_to_message_id = Number(msg.replyToId);
    }
    return payload;
  }

  async sendMessage(chatId: string, text: string, replyToId?: string): Promise<boolean> {
    if (!this.botToken) {
      console.error('[TelegramAdapter] sendMessage called without a bot token');
      return false;
    }

    return sendTelegramMessage(this.botToken, chatId, text, replyToId ? Number(replyToId) : undefined);
  }

  verifyWebhook(headers: Headers): boolean {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) return true; // dev mode — no secret configured

    const incoming = headers.get('X-Telegram-Bot-Api-Secret-Token');
    return incoming === secret;
  }
}

// ---------------------------------------------------------------------------
// Standalone helpers
// ---------------------------------------------------------------------------

/**
 * Send a message via the Telegram Bot API.
 * Retries once on 429 (rate limit) using the retry_after value.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyTo?: number
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body: TelegramSendMessagePayload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyTo !== undefined) body.reply_to_message_id = replyTo;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const data = (await res.json()) as TelegramApiResponse;
      const retryAfter = data.parameters?.retry_after ?? 1;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));

      const retry = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return retry.ok;
    }

    if (!res.ok) {
      const data = (await res.json()) as TelegramApiResponse;
      console.error('[TelegramAdapter] sendMessage failed:', data.description);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TelegramAdapter] sendMessage error:', err);
    return false;
  }
}

/**
 * Register a webhook URL with the Telegram Bot API.
 * Called when the user saves their bot token in settings.
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken?: string
): Promise<{ success: boolean; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const body: Record<string, unknown> = { url: webhookUrl };
  if (secretToken) body.secret_token = secretToken;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as TelegramApiResponse;

    if (!data.ok) {
      return { success: false, error: data.description ?? 'Unknown Telegram API error' };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.error('[TelegramAdapter] setWebhook error:', err);
    return { success: false, error: message };
  }
}

/**
 * Factory — creates a TelegramAdapter, using env var if no token passed.
 */
export function createTelegramAdapter(botToken?: string): TelegramAdapter {
  return new TelegramAdapter(botToken);
}
