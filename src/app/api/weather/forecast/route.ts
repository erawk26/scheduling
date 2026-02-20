/**
 * Weather Forecast API Route
 *
 * Proxies requests to Tomorrow.io, keeping the API key server-side.
 * GET /api/weather/forecast?lat=X&lon=X
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherForecast } from '@/lib/weather/service';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');

  if (!latStr || !lonStr) {
    return NextResponse.json(
      { error: 'Missing required parameters: lat, lon' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: 'Invalid lat/lon values' },
      { status: 400 }
    );
  }

  const forecasts = await fetchWeatherForecast(lat, lon);

  if (!forecasts) {
    return NextResponse.json(
      { error: 'Weather data unavailable' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { forecasts, location: { lat, lon } },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    }
  );
}
