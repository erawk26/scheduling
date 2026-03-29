/**
 * Email Send API Route
 *
 * POST /api/email/send
 * Accepts { to, templateName, templateData }, renders template, sends via Resend.
 * Server-side only — RESEND_API_KEY never reaches the client.
 */

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/resend-client'
import {
  bookingInvitationTemplate,
  bookingConfirmationTemplate,
  bookingReminderTemplate,
} from '@/lib/email/templates'

const requestSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  templateName: z.enum(['booking-invitation', 'booking-confirmation', 'booking-reminder']),
  templateData: z.record(z.string(), z.unknown()),
})

function renderTemplate(templateName: string, data: Record<string, unknown>): string | null {
  switch (templateName) {
    case 'booking-invitation':
      return bookingInvitationTemplate(data as unknown as Parameters<typeof bookingInvitationTemplate>[0])
    case 'booking-confirmation':
      return bookingConfirmationTemplate(data as unknown as Parameters<typeof bookingConfirmationTemplate>[0])
    case 'booking-reminder':
      return bookingReminderTemplate(data as unknown as Parameters<typeof bookingReminderTemplate>[0])
    default:
      return null
  }
}

function subjectForTemplate(templateName: string, data: Record<string, unknown>): string {
  const business = typeof data.businessName === 'string' ? data.businessName : 'Your provider'
  const service = typeof data.serviceName === 'string' ? data.serviceName : 'appointment'

  switch (templateName) {
    case 'booking-invitation':
      return `${business} — Choose your ${service} appointment time`
    case 'booking-confirmation':
      return `${business} — Your ${service} appointment is confirmed`
    case 'booking-reminder':
      return `Reminder: ${service} appointment with ${business}`
    default:
      return 'Appointment notification'
  }
}

export const Route = createFileRoute('/api/email/send')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.RESEND_API_KEY) {
          return Response.json(
            { error: 'Email service is not configured. Set RESEND_API_KEY in environment.' },
            { status: 500 }
          )
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = requestSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
            { status: 400 }
          )
        }

        const { to, templateName, templateData } = parsed.data

        const html = renderTemplate(templateName, templateData)
        if (!html) {
          return Response.json({ error: `Unknown template: ${templateName}` }, { status: 400 })
        }

        const subject = subjectForTemplate(templateName, templateData)
        const result = await sendEmail({ to, subject, html })

        if (!result.success) {
          return Response.json({ error: result.error }, { status: 502 })
        }

        return Response.json({ success: true, messageId: result.messageId })
      },
    },
  },
})
