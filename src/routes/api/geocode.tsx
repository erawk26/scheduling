import { createFileRoute } from '@tanstack/react-router'
import { geocode } from '@/lib/graphhopper/client'

export const Route = createFileRoute('/api/geocode')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { address } = body

          if (!address || typeof address !== 'string') {
            return Response.json({ error: 'Address is required' }, { status: 400 })
          }

          if (!process.env.GRAPHHOPPER_API_KEY) {
            return Response.json({ error: 'Geocoding not configured' }, { status: 503 })
          }

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
