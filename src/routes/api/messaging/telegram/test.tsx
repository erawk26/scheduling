/**
 * POST /api/messaging/telegram/test
 *
 * Sends a test message to verify the Telegram bot is reachable.
 * Requires bot token to be configured in environment.
 */

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { sendTelegramMessage } from '@/lib/messaging/adapters'

const TestSchema = z.object({
  chatId: z.string().min(1, 'Chat ID is required'),
})

export const Route = createFileRoute('/api/messaging/telegram/test')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = TestSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { success: false, error: parsed.error.errors[0]?.message ?? 'Validation failed' },
            { status: 400 }
          )
        }

        const { chatId } = parsed.data
        const botToken = process.env.TELEGRAM_BOT_TOKEN

        if (!botToken) {
          return Response.json(
            { success: false, error: 'Telegram bot token not configured on server' },
            { status: 503 }
          )
        }

        const testMessage = `🟢 Test message from KE Agenda!

Your Telegram bot integration is working correctly.

Timestamp: ${new Date().toISOString()}
`

        const success = await sendTelegramMessage(botToken, chatId, testMessage)

        if (success) {
          return Response.json({ success: true, message: 'Test message sent successfully' })
        } else {
          return Response.json(
            { success: false, error: 'Failed to send test message. Check bot token and chat ID.' },
            { status: 502 }
          )
        }
      },
    },
  },
})
