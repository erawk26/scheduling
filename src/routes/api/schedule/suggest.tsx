import { createFileRoute } from '@tanstack/react-router'
import { generateSuggestions } from '@/lib/schedule-intelligence/suggester'
import type { AnalysisAppointment, WeeklySuggestions } from '@/lib/schedule-intelligence/types'
import type { SuggesterOptions } from '@/lib/schedule-intelligence/suggester'

interface RequestBody {
  appointmentsByDate: Record<string, AnalysisAppointment[]>
  options?: SuggesterOptions
}

export const Route = createFileRoute('/api/schedule/suggest')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        try {
          const body = (await request.json()) as RequestBody

          if (!body.appointmentsByDate || typeof body.appointmentsByDate !== 'object') {
            return Response.json({ error: 'appointmentsByDate is required' }, { status: 400 })
          }

          const map = new Map<string, AnalysisAppointment[]>(
            Object.entries(body.appointmentsByDate)
          )

          const suggestions: WeeklySuggestions = generateSuggestions(map, body.options)
          return Response.json(suggestions)
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
            { status: 500 }
          )
        }
      },
    },
  },
})
