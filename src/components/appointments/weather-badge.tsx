/**
 * Weather Alert Badge
 *
 * Shows an amber warning when a weather-dependent service
 * has bad weather forecast on the appointment date.
 * See: /docs/design/component-library.md:453-463
 */

import {
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Thermometer,
} from 'lucide-react';
import type { WeatherForecast } from '@/lib/weather/types';
import { useWeatherForDate } from '@/hooks/use-weather';

interface WeatherBadgeProps {
  forecast: WeatherForecast;
  compact?: boolean;
}

function getAlertIcon(forecast: WeatherForecast) {
  const { weather_code, wind_speed_mph, temp_high_f } = forecast;

  // Thunderstorm
  if (weather_code === 8000) return CloudLightning;
  // Snow/ice
  if (weather_code >= 5000 && weather_code < 7200) return CloudSnow;
  // Rain/drizzle/freezing
  if (weather_code >= 4000 && weather_code < 5000) return CloudRain;
  if (weather_code >= 6000 && weather_code < 7000) return CloudRain;
  // Wind
  if (wind_speed_mph >= 20) return Wind;
  // Temperature
  if (temp_high_f < 32 || temp_high_f > 95) return Thermometer;
  // Generic
  return Cloud;
}

function getAlertReason(forecast: WeatherForecast): string {
  const reasons: string[] = [];

  if (forecast.precip_probability >= 40) {
    reasons.push(`${forecast.precip_probability}% precipitation`);
  }
  if (forecast.wind_speed_mph >= 20) {
    reasons.push(`${forecast.wind_speed_mph} mph wind`);
  }
  if (forecast.temp_high_f < 32) {
    reasons.push(`${forecast.temp_high_f}°F (freezing)`);
  }
  if (forecast.temp_high_f > 95) {
    reasons.push(`${forecast.temp_high_f}°F (extreme heat)`);
  }

  return reasons.length > 0
    ? reasons.join(', ')
    : forecast.condition_label;
}

/**
 * Compact badge for appointment cards (inline with other badges)
 */
export function WeatherBadge({ forecast, compact = false }: WeatherBadgeProps) {
  if (forecast.is_outdoor_suitable) return null;

  const Icon = getAlertIcon(forecast);
  const reason = getAlertReason(forecast);

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"
        title={`Weather alert: ${reason}`}
      >
        <Icon className="h-3 w-3" />
        Weather
      </span>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
      <Icon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-amber-800">Weather Alert</p>
        <p className="text-xs text-amber-700 mt-0.5">
          {reason}. Consider rescheduling.
        </p>
      </div>
    </div>
  );
}

/**
 * Self-fetching weather badge for appointment cards.
 * Uses client coordinates when available. TanStack Query
 * deduplicates identical coordinate pairs automatically.
 */
export function AppointmentWeatherBadge({
  clientLat,
  clientLon,
  fallbackLat,
  fallbackLon,
  appointmentDate,
  isWeatherDependent,
  compact = true,
}: {
  clientLat: number | null;
  clientLon: number | null;
  fallbackLat?: number | null;
  fallbackLon?: number | null;
  appointmentDate: string;
  isWeatherDependent: boolean;
  compact?: boolean;
}) {
  // Fallback chain: client coords → business location
  const effectiveLat = clientLat ?? fallbackLat ?? null;
  const effectiveLon = clientLon ?? fallbackLon ?? null;

  // Round to 0.1° (~7 miles) for cache efficiency
  const roundedLat = effectiveLat !== null ? Math.round(effectiveLat * 10) / 10 : null;
  const roundedLon = effectiveLon !== null ? Math.round(effectiveLon * 10) / 10 : null;

  const date = appointmentDate.slice(0, 10);
  const { data: forecast } = useWeatherForDate(roundedLat, roundedLon, date);

  if (!isWeatherDependent || !forecast || forecast.is_outdoor_suitable) return null;

  return <WeatherBadge forecast={forecast} compact={compact} />;
}

/**
 * Tiny weather icon for calendar day cells
 */
export function WeatherDayIcon({ forecast }: { forecast: WeatherForecast }) {
  if (forecast.is_outdoor_suitable) return null;

  const Icon = getAlertIcon(forecast);

  return (
    <Icon
      className="h-3 w-3 text-amber-500"
      aria-label={`Weather alert: ${forecast.condition_label}`}
    />
  );
}
