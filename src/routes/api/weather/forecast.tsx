/**
 * Weather Forecast API Route
 *
 * Proxies requests to Tomorrow.io, keeping the API key server-side.
 * GET /api/weather/forecast?lat=X&lon=X
 */

import { createFileRoute } from '@tanstack/react-router'
import { fetchWeatherForecast } from '@/lib/weather/service'

export const Route = createFileRoute('/api/weather/forecast')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url)
        const latStr = searchParams.get('lat')
        const lonStr = searchParams.get('lon')

        if (!latStr || !lonStr) {
          return Response.json(
            { error: 'Missing required parameters: lat, lon' },
            { status: 400 }
          )
        }

        const lat = parseFloat(latStr)
        const lon = parseFloat(lonStr)

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return Response.json({ error: 'Invalid lat/lon values' }, { status: 400 })
        }

        const forecasts = await fetchWeatherForecast(lat, lon)

        if (!forecasts) {
          return Response.json({ error: 'Weather data unavailable' }, { status: 503 })
        }

        return new Response(JSON.stringify({ forecasts, location: { lat, lon } }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
          },
        })
      },
    },
  },
})
