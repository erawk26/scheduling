import { useState, useCallback } from 'react';
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
import { useBusinessLocation } from '@/hooks/use-business-location';
import { useAppointments } from '@/hooks/use-appointments';
import { useClients } from '@/hooks/use-clients';
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

type LocationMode = 'business' | 'next_appointment' | 'browser';

export default function WeatherPage() {
  const [mode, setMode] = useState<LocationMode>('business');

  // Data sources
  const { data: bizLoc } = useBusinessLocation();
  const { data: appointments } = useAppointments();
  const { data: clients } = useClients();
  const { data: services } = useServices();

  // Next upcoming appointment's client location (computed but only used when toggled)
  const now = new Date().toISOString();
  const nextApt = (appointments ?? [])
    .filter((a) => a.start_time > now && a.status !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const nextClient = nextApt && clients
    ? clients.find((c) => c.id === nextApt.client_id)
    : null;
  const nextAptLat = nextClient?.latitude ?? nextApt?.latitude ?? null;
  const nextAptLon = nextClient?.longitude ?? nextApt?.longitude ?? null;
  const hasNextAptLoc = nextAptLat != null && nextAptLon != null;

  // Browser geolocation (only triggered on demand)
  const [browserLat, setBrowserLat] = useState<number | null>(null);
  const [browserLon, setBrowserLon] = useState<number | null>(null);
  const [geoDetecting, setGeoDetecting] = useState(false);
  const requestBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBrowserLat(Math.round(pos.coords.latitude * 100) / 100);
        setBrowserLon(Math.round(pos.coords.longitude * 100) / 100);
        setGeoDetecting(false);
      },
      () => setGeoDetecting(false),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  // Resolve lat/lon based on selected mode
  const hasBizLoc = bizLoc?.lat != null && bizLoc?.lon != null;
  let lat: number | null = null;
  let lon: number | null = null;
  let locationLabel = '';

  if (mode === 'business' && hasBizLoc) {
    lat = bizLoc!.lat;
    lon = bizLoc!.lon;
    locationLabel = 'Business location';
  } else if (mode === 'next_appointment' && hasNextAptLoc) {
    lat = nextAptLat;
    lon = nextAptLon;
    locationLabel = `Next appointment \u2014 ${nextClient?.first_name ?? ''} ${nextClient?.last_name ?? ''}`.trim();
  } else if (mode === 'browser' && browserLat != null) {
    lat = browserLat;
    lon = browserLon;
    locationLabel = 'Browser location';
  } else if (hasBizLoc) {
    // Fallback to business if selected mode has no data
    lat = bizLoc!.lat;
    lon = bizLoc!.lon;
    locationLabel = 'Business location (fallback)';
  }

  const { data: forecasts, isLoading, isError } = useWeatherForecast(lat, lon);

  // Build a set of weather-dependent service IDs
  const weatherDependentServiceIds = new Set(
    services?.filter((s) => s.weather_dependent).map((s) => s.id) ?? []
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
        <h1 className="text-3xl font-bold text-foreground">Weather</h1>
        <p className="mt-2 text-muted-foreground">
          Weather-integrated scheduling for outdoor services
        </p>
      </div>

      {/* Location Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-lg border p-1">
          {hasBizLoc && (
            <Button
              variant={mode === 'business' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('business')}
            >
              Business
            </Button>
          )}
          {hasNextAptLoc && (
            <Button
              variant={mode === 'next_appointment' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('next_appointment')}
            >
              Next Appointment
            </Button>
          )}
          <Button
            variant={mode === 'browser' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMode('browser');
              if (browserLat === null) requestBrowserLocation();
            }}
          >
            {geoDetecting ? 'Detecting...' : 'My Location'}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {lat !== null && lon !== null ? (
            <span>{locationLabel}</span>
          ) : (
            <span className="text-warning-muted-foreground">
              No location available. Set your business location in Settings.
            </span>
          )}
        </div>
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
            <CloudOff className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">Weather data unavailable</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
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
                  className="h-16 w-16 text-primary"
                />
                <div>
                  <div className="text-4xl font-bold text-foreground">
                    {todayForecast.temp_current_f}°F
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Feels like {todayForecast.feels_like_f}°F
                  </div>
                  <div className="text-sm font-medium text-foreground mt-1">
                    {todayForecast.condition_label}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Thermometer className="h-4 w-4" />
                  <span>
                    H: {todayForecast.temp_high_f}° / L: {todayForecast.temp_low_f}°
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wind className="h-4 w-4" />
                  <span>
                    {todayForecast.wind_speed_mph} mph
                    {todayForecast.wind_gust_mph > todayForecast.wind_speed_mph &&
                      ` (gusts ${todayForecast.wind_gust_mph})`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Droplets className="h-4 w-4" />
                  <span>{todayForecast.humidity}% humidity</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CloudRain className="h-4 w-4" />
                  <span>{todayForecast.precip_probability}% precipitation</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>UV Index: {todayForecast.uv_index}</span>
                </div>
                <div className="flex items-center gap-2">
                  {todayForecast.is_outdoor_suitable ? (
                    <Badge className="bg-success-muted text-success-muted-foreground border-success-muted-foreground/20">
                      Outdoor Suitable
                    </Badge>
                  ) : (
                    <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20">
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
          <h2 className="text-lg font-semibold text-foreground mb-4">5-Day Forecast</h2>
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
              <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
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
                    className="flex items-center gap-3 p-3 rounded-lg border border-warning-muted-foreground/20 bg-warning-muted"
                  >
                    {forecast && (
                      <WeatherIcon
                        name={forecast.condition_icon}
                        className="h-5 w-5 text-warning-muted-foreground shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-warning-muted-foreground">
                        {format(parseISO(apt.start_time), 'MMM d')} at{' '}
                        {format(parseISO(apt.start_time), 'h:mm a')}
                      </p>
                      <p className="text-xs text-warning-muted-foreground">
                        {forecast?.condition_label} &mdash;{' '}
                        {forecast && forecast.precip_probability >= 40
                          ? `${forecast.precip_probability}% precipitation`
                          : forecast && forecast.wind_speed_mph >= 20
                          ? `${forecast.wind_speed_mph} mph wind`
                          : 'Unfavorable conditions'}
                      </p>
                    </div>
                    <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20 shrink-0">
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
    <Card className={!forecast.is_outdoor_suitable ? 'border-warning-muted-foreground/20' : ''}>
      <CardContent className="p-4 text-center">
        <div className="text-sm font-medium text-foreground">{dayLabel}</div>
        <div className="text-xs text-muted-foreground mb-3">{dateLabel}</div>

        <WeatherIcon
          name={forecast.condition_icon}
          className="h-10 w-10 mx-auto text-primary mb-2"
        />

        <div className="text-sm font-medium text-foreground mb-2">
          {forecast.condition_label}
        </div>

        <div className="text-lg font-bold text-foreground">
          {forecast.temp_high_f}°
          <span className="text-sm font-normal text-muted-foreground ml-1">
            / {forecast.temp_low_f}°
          </span>
        </div>

        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
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
          <Badge className="mt-3 bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20 text-xs">
            Not Outdoor Safe
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
