/**
 * Book Confirm API Route
 *
 * POST /api/book/confirm
 * Accepts { token, selectedSlot? } or { token, declineReason? }
 * Verifies JWT, writes result to .omc/bookings/{appointmentId}.json
 */

import { createFileRoute } from '@tanstack/react-router'
import { verifyBookingToken } from '@/lib/email/jwt'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { z } from 'zod'

const ConfirmSchema = z.object({
  token: z.string().min(1),
  selectedSlot: z.string().optional(),
  declineReason: z.string().optional(),
})

async function writeBookingResult(
  appointmentId: string,
  data: Record<string, unknown>
): Promise<void> {
  const dir = path.join(process.cwd(), '.omc', 'bookings')
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${appointmentId}.json`)
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

export const Route = createFileRoute('/api/book/confirm')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof ConfirmSchema>

        try {
          const raw = await request.json()
          body = ConfirmSchema.parse(raw)
        } catch {
          return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { token, selectedSlot, declineReason } = body

        if (!token) {
          return Response.json({ error: 'Missing token' }, { status: 400 })
        }

        const result = await verifyBookingToken(token)

        if (!result) {
          return Response.json({ error: 'Invalid token' }, { status: 400 })
        }

        if (result.expired) {
          return Response.json({ error: 'Booking link has expired' }, { status: 400 })
        }

        const { appointmentId, clientId } = result.payload

        if (selectedSlot) {
          await writeBookingResult(appointmentId, {
            clientId,
            selectedSlot,
            confirmedAt: new Date().toISOString(),
            status: 'confirmed',
          })

          return Response.json({
            success: true,
            redirectTo: `/book/${token}/confirmed`,
          })
        }

        if (declineReason) {
          await writeBookingResult(appointmentId, {
            clientId,
            declineReason,
            declinedAt: new Date().toISOString(),
            status: 'declined',
          })

          return Response.json({ success: true, status: 'declined' })
        }

        return Response.json(
          { error: 'Must provide selectedSlot or declineReason' },
          { status: 400 }
        )
      },
    },
  },
})
