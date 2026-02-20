/**
 * Weather Hooks - TanStack Query
 *
 * Client-side hooks for fetching weather forecasts.
 * Follows existing hook patterns (named exports, error handling).
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { WeatherForecast, WeatherResponse } from '@/lib/weather/types';

/**
 * Fetch weather forecasts for a location.
 * 30-minute stale time since weather doesn't change fast.
 * Returns null gracefully when offline or API unavailable.
 */
export function useWeatherForecast(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ['weather', 'forecast', lat, lon],
    queryFn: async (): Promise<WeatherForecast[]> => {
      const response = await fetch(
        `/api/weather/forecast?lat=${lat}&lon=${lon}`
      );

      if (!response.ok) {
        throw new Error('Weather data unavailable');
      }

      const data: WeatherResponse = await response.json();
      return data.forecasts;
    },
    enabled: lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    meta: { errorMessage: 'Failed to fetch weather data' },
  });
}

/**
 * Convenience hook for a specific date's forecast.
 * Returns the forecast matching the given date string (YYYY-MM-DD),
 * or undefined if not found / not loaded yet.
 */
export function useWeatherForDate(
  lat: number | null,
  lon: number | null,
  date: string | null
) {
  const { data: forecasts, ...rest } = useWeatherForecast(lat, lon);

  const forecast = date
    ? forecasts?.find((f) => f.date === date)
    : undefined;

  return { data: forecast, ...rest };
}
