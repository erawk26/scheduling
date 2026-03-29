import { createFileRoute } from '@tanstack/react-router'
import { optimizeRoute, creditTracker } from '@/lib/graphhopper/client'
import type { VRPRequest, OptimizationResult, OptimizedStop } from '@/lib/graphhopper/types'

export const Route = createFileRoute('/api/routes/optimize')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const stops = body.stops as Array<{
            id: string
            lat: number
            lon: number
            duration_minutes: number
          }>
          const start = body.start as { lat: number; lon: number } | undefined

          if (!stops?.length || stops.length < 2) {
            return Response.json({ error: 'At least 2 stops required' }, { status: 400 })
          }

          if (!process.env.GRAPHHOPPER_API_KEY) {
            return Response.json({ error: 'Route optimization not configured' }, { status: 503 })
          }

          if (!creditTracker.canSpend(10)) {
            return Response.json({ error: 'Daily credit limit reached' }, { status: 429 })
          }

          const startLat = start?.lat ?? stops[0]!.lat
          const startLon = start?.lon ?? stops[0]!.lon

          const vrpRequest: VRPRequest = {
            vehicles: [
              {
                vehicle_id: 'driver-1',
                type_id: 'car',
                shifts: [
                  {
                    start_address: { location_id: 'start', lat: startLat, lon: startLon },
                  },
                ],
              },
            ],
            vehicle_types: [
              {
                type_id: 'car',
                profile: 'car',
              },
            ],
            services: stops.map((s) => ({
              id: s.id,
              address: { location_id: s.id, lat: s.lat, lon: s.lon },
              duration: (s.duration_minutes || 30) * 60,
            })),
            configuration: {
              routing: { calc_points: true },
            },
          }

          const vrpResponse = await optimizeRoute(vrpRequest)

          if (!vrpResponse.solution?.routes?.length) {
            return Response.json({ error: 'No route found' }, { status: 404 })
          }

          const route = vrpResponse.solution.routes[0]!

          const optimizedStops: OptimizedStop[] = route.activities
            .filter((a) => a.type === 'service' && a.id)
            .map((a) => ({
              id: a.id!,
              arrivalTimeS: a.arr_time,
              departureTimeS: a.end_time,
              distanceM: a.distance ?? 0,
              drivingTimeS: a.driving_time ?? 0,
            }))

          const result: OptimizationResult = {
            stops: optimizedStops,
            totalDistanceM: route.distance,
            totalTimeS: route.transport_time,
            polyline: route.points,
            source: 'graphhopper',
          }

          return Response.json(result)
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : 'Optimization failed' },
            { status: 500 }
          )
        }
      },
    },
  },
})
