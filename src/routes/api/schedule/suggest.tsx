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
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const typedBody = body as RequestBody

        if (!typedBody.appointmentsByDate || typeof typedBody.appointmentsByDate !== 'object') {
          return Response.json({ error: 'appointmentsByDate is required' }, { status: 400 })
        }

        const map = new Map<string, AnalysisAppointment[]>(
          Object.entries(typedBody.appointmentsByDate)
        )

        try {
          const suggestions: WeeklySuggestions = generateSuggestions(map, typedBody.options)
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
