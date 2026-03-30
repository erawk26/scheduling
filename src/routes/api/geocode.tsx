import { createFileRoute } from '@tanstack/react-router'
import { geocode } from '@/lib/graphhopper/client'

export const Route = createFileRoute('/api/geocode')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { address } = body as { address?: unknown }

        if (!address || typeof address !== 'string') {
          return Response.json({ error: 'Address is required' }, { status: 400 })
        }

        if (!process.env.GRAPHHOPPER_API_KEY) {
          return Response.json({ error: 'Geocoding not configured' }, { status: 503 })
        }

        try {
          const result = await geocode(address)

          if (!result) {
            return Response.json({ error: 'Address not found' }, { status: 404 })
          }

          return Response.json(result)
        } catch {
          return Response.json({ error: 'Geocoding failed' }, { status: 500 })
        }
      },
    },
  },
})
