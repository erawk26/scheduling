/**
 * Messaging Webhook — receives inbound messages from any platform.
 * POST /api/messaging/webhook?platform=telegram
 *
 * Always returns 200 OK to prevent webhook retry storms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MessageBridge } from '@/lib/messaging/bridge';
import { createTelegramAdapter } from '@/lib/messaging/adapters';

const bridge = new MessageBridge([createTelegramAdapter()]);

export { bridge as messagingBridge };

export async function POST(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform');

  if (!platform) {
    // Return 200 so caller doesn't retry
    return NextResponse.json({ ok: false, error: 'Missing platform param' }, { status: 200 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 200 });
  }

  const adapter = bridge.getAdapter(platform);

  // Verify webhook signature if the adapter supports it
  if (adapter?.verifyWebhook && !adapter.verifyWebhook(request.headers)) {
    return NextResponse.json({ ok: false, error: 'Webhook verification failed' }, { status: 200 });
  }

  try {
    const result = await bridge.handleInbound(platform, rawPayload);

    if (!result) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, response: result.response });
  } catch (err) {
    console.error('[messaging/webhook] Internal error:', err);
    // Return 200 to prevent webhook retry
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
