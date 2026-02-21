'use client';

import { format, parseISO } from 'date-fns';
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudFog,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  CloudOff,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeatherForecast } from '@/hooks/use-weather';
import { useUserLocation } from '@/hooks/use-user-location';
import { useBusinessLocation } from '@/hooks/use-business-location';
import { useAppointments } from '@/hooks/use-appointments';
import { useServices } from '@/hooks/use-services';
import type { WeatherForecast } from '@/lib/weather/types';

// ============================================================================
// Icon mapping from string name to Lucide component
// ============================================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudFog,
  Snowflake,
  CloudHail: CloudRain, // fallback
};

function WeatherIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Cloud;
  return <Icon className={className} />;
}

// ============================================================================
// Page Component
// ============================================================================

export default function WeatherPage() {
  const { lat: geoLat, lon: geoLon, status: geoStatus, requestLocation } = useUserLocation();
  const { data: bizLoc } = useBusinessLocation();

  // Business location takes priority, browser geolocation as fallback
  const lat = bizLoc?.lat ?? geoLat;
  const lon = bizLoc?.lon ?? geoLon;
  const hasBizLoc = bizLoc?.lat != null && bizLoc?.lon != null;

  const { data: forecasts, isLoading, isError } = useWeatherForecast(lat, lon);
  const { data: appointments } = useAppointments();
  const { data: services } = useServices();

  // Build a set of weather-dependent service IDs
  const weatherDependentServiceIds = new Set(
    services?.filter((s) => s.weather_dependent === 1).map((s) => s.id) ?? []
  );

  // Find weather-dependent appointments on bad-weather days
  const weatherAlertAppointments = (appointments ?? []).filter((apt) => {
    if (!weatherDependentServiceIds.has(apt.service_id)) return false;
    const aptDate = apt.start_time.slice(0, 10);
    const forecast = forecasts?.find((f) => f.date === aptDate);
    return forecast && !forecast.is_outdoor_suitable;
  });

  const todayForecast = forecasts?.[0];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Weather</h1>
        <p className="mt-2 text-gray-600">
          Weather-integrated scheduling for outdoor services
        </p>
      </div>

      {/* Location Status */}
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <MapPin className="h-4 w-4" />
        {hasBizLoc ? (
          <span>
            Using your business location ({lat}, {lon})
          </span>
        ) : geoStatus === 'loading' ? (
          <span>Detecting your location...</span>
        ) : lat !== null && lon !== null ? (
          <span>
            Using browser location ({lat}, {lon})
          </span>
        ) : geoStatus === 'denied' ? (
          <span className="text-amber-700">
            Location access denied. Set your business location in Settings.
          </span>
        ) : null}
        {!hasBizLoc && (geoStatus === 'denied' || geoStatus === 'granted') && (
          <Button variant="outline" size="sm" onClick={requestLocation}>
            <MapPin className="h-3 w-3 mr-1" />
            Update Location
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      )}

      {/* Error / Offline State */}
      {isError && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CloudOff className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Weather data unavailable</p>
            <p className="text-sm text-gray-400 mt-2 max-w-md">
              Unable to fetch weather data. This may be because you&apos;re offline
              or the weather service is temporarily unavailable.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current Conditions */}
      {todayForecast && (
        <Card>
          <CardHeader>
            <CardTitle>Current Conditions</CardTitle>
            <CardDescription>
              {format(parseISO(todayForecast.date), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <WeatherIcon
                  name={todayForecast.condition_icon}
                  className="h-16 w-16 text-blue-500"
                />
                <div>
                  <div className="text-4xl font-bold text-gray-900">
                    {todayForecast.temp_current_f}°F
                  </div>
                  <div className="text-sm text-gray-500">
                    Feels like {todayForecast.feels_like_f}°F
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-1">
                    {todayForecast.condition_label}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Thermometer className="h-4 w-4" />
                  <span>
                    H: {todayForecast.temp_high_f}° / L: {todayForecast.temp_low_f}°
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Wind className="h-4 w-4" />
                  <span>
                    {todayForecast.wind_speed_mph} mph
                    {todayForecast.wind_gust_mph > todayForecast.wind_speed_mph &&
                      ` (gusts ${todayForecast.wind_gust_mph})`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Droplets className="h-4 w-4" />
                  <span>{todayForecast.humidity}% humidity</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CloudRain className="h-4 w-4" />
                  <span>{todayForecast.precip_probability}% precipitation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Eye className="h-4 w-4" />
                  <span>UV Index: {todayForecast.uv_index}</span>
                </div>
                <div className="flex items-center gap-2">
                  {todayForecast.is_outdoor_suitable ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Outdoor Suitable
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      Not Ideal for Outdoor
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5-Day Forecast */}
      {forecasts && forecasts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">5-Day Forecast</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {forecasts.map((forecast) => (
              <ForecastCard key={forecast.date} forecast={forecast} />
            ))}
          </div>
        </div>
      )}

      {/* Weather Alerts for Appointments */}
      {weatherAlertAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle>Weather Alerts</CardTitle>
            </div>
            <CardDescription>
              Weather-dependent appointments with unfavorable conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weatherAlertAppointments.map((apt) => {
                const aptDate = apt.start_time.slice(0, 10);
                const forecast = forecasts?.find((f) => f.date === aptDate);
                return (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50"
                  >
                    {forecast && (
                      <WeatherIcon
                        name={forecast.condition_icon}
                        className="h-5 w-5 text-amber-600 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-amber-800">
                        {format(parseISO(apt.start_time), 'MMM d')} at{' '}
                        {format(parseISO(apt.start_time), 'h:mm a')}
                      </p>
                      <p className="text-xs text-amber-700">
                        {forecast?.condition_label} &mdash;{' '}
                        {forecast && forecast.precip_probability >= 40
                          ? `${forecast.precip_probability}% precipitation`
                          : forecast && forecast.wind_speed_mph >= 20
                          ? `${forecast.wind_speed_mph} mph wind`
                          : 'Unfavorable conditions'}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                      Weather Dependent
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Forecast Card
// ============================================================================

function ForecastCard({ forecast }: { forecast: WeatherForecast }) {
  const dayLabel = format(parseISO(forecast.date), 'EEE');
  const dateLabel = format(parseISO(forecast.date), 'MMM d');

  return (
    <Card className={!forecast.is_outdoor_suitable ? 'border-amber-200' : ''}>
      <CardContent className="p-4 text-center">
        <div className="text-sm font-medium text-gray-900">{dayLabel}</div>
        <div className="text-xs text-gray-500 mb-3">{dateLabel}</div>

        <WeatherIcon
          name={forecast.condition_icon}
          className="h-10 w-10 mx-auto text-blue-500 mb-2"
        />

        <div className="text-sm font-medium text-gray-700 mb-2">
          {forecast.condition_label}
        </div>

        <div className="text-lg font-bold text-gray-900">
          {forecast.temp_high_f}°
          <span className="text-sm font-normal text-gray-500 ml-1">
            / {forecast.temp_low_f}°
          </span>
        </div>

        <div className="mt-3 space-y-1 text-xs text-gray-500">
          <div className="flex items-center justify-center gap-1">
            <Droplets className="h-3 w-3" />
            {forecast.precip_probability}%
          </div>
          <div className="flex items-center justify-center gap-1">
            <Wind className="h-3 w-3" />
            {forecast.wind_speed_mph} mph
          </div>
        </div>

        {!forecast.is_outdoor_suitable && (
          <Badge className="mt-3 bg-amber-100 text-amber-800 border-amber-200 text-xs">
            Not Outdoor Safe
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
