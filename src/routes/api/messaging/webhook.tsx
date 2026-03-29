/**
 * Messaging Webhook — receives inbound messages from any platform.
 * POST /api/messaging/webhook?platform=telegram
 *
 * Always returns 200 OK to prevent webhook retry storms.
 */

import { createFileRoute } from '@tanstack/react-router'
import { MessageBridge } from '@/lib/messaging/bridge'
import { createTelegramAdapter } from '@/lib/messaging/adapters'

const bridge = new MessageBridge([createTelegramAdapter()])

export const Route = createFileRoute('/api/messaging/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const platform = new URL(request.url).searchParams.get('platform')

        if (!platform) {
          // Return 200 so caller doesn't retry
          return Response.json({ ok: false, error: 'Missing platform param' }, { status: 200 })
        }

        let rawPayload: unknown
        try {
          rawPayload = await request.json()
        } catch {
          return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 200 })
        }

        const adapter = bridge.getAdapter(platform)

        // Verify webhook signature if the adapter supports it
        if (adapter?.verifyWebhook && !adapter.verifyWebhook(request.headers)) {
          return Response.json({ ok: false, error: 'Webhook verification failed' }, { status: 200 })
        }

        try {
          const result = await bridge.handleInbound(platform, rawPayload)

          if (!result) {
            return Response.json({ ok: true })
          }

          return Response.json({ ok: true, response: result.response })
        } catch {
          // Return 200 to prevent webhook retry
          return Response.json({ ok: false }, { status: 200 })
        }
      },
    },
  },
})
