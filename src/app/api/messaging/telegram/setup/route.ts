/**
 * POST /api/messaging/telegram/setup
 *
 * Registers a Telegram bot webhook. Called when the user saves
 * their bot token and webhook URL in settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setTelegramWebhook } from '@/lib/messaging/adapters';

const BOT_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]{35,}$/;

const SetupSchema = z.object({
  botToken: z.string().regex(BOT_TOKEN_REGEX, 'Invalid bot token format'),
  webhookUrl: z.string().url('webhookUrl must be a valid URL'),
  secretToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    );
  }

  const { botToken, webhookUrl, secretToken } = parsed.data;
  const result = await setTelegramWebhook(botToken, webhookUrl, secretToken);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
