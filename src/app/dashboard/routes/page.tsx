import { useState, useEffect, lazy } from 'react';

import { format, parseISO } from 'date-fns';
import { Navigation, MapPin, Clock, Route, Car, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOptimizedRoute } from '@/hooks/use-routes';
import { fetchCreditUsage } from '@/lib/graphhopper/optimize';

const RouteMap = lazy(
  () => import('@/components/routes/route-map').then((m) => ({ default: m.RouteMap }))
);

const KM_TO_MILES = 0.621371;
const AVG_SPEED_MPH = 30;

function toMiles(km: number): string {
  return (km * KM_TO_MILES).toFixed(1);
}

function estimateDriveMinutes(km: number): number {
  return Math.round((km * KM_TO_MILES) / AVG_SPEED_MPH * 60);
}

function formatDriveTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildMapsUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIos
    ? `maps://maps.apple.com/?q=${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function SummaryCard({
  stopCount,
  distanceKm,
  totalDrivingTimeS,
  skippedCount,
}: {
  stopCount: number;
  distanceKm: number;
  totalDrivingTimeS?: number;
  skippedCount: number;
}) {
  let driveLabel: string;
  if (totalDrivingTimeS != null && totalDrivingTimeS > 0) {
    driveLabel = formatDriveTime(totalDrivingTimeS);
  } else {
    const driveMin = estimateDriveMinutes(distanceKm);
    const driveHours = Math.floor(driveMin / 60);
    const driveRem = driveMin % 60;
    driveLabel = driveHours > 0 ? `${driveHours}h ${driveRem}m` : `${driveRem}m`;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
        <div className="rounded-lg bg-info-muted p-2">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stopCount}</p>
          <p className="text-xs text-muted-foreground">Stops</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
        <div className="rounded-lg bg-success-muted p-2">
          <Car className="h-5 w-5 text-success-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{toMiles(distanceKm)}</p>
          <p className="text-xs text-muted-foreground">{totalDrivingTimeS ? 'Road miles' : 'Est. miles'}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-white p-4 col-span-2 sm:col-span-1">
        <div className="rounded-lg bg-fern-pale p-2">
          <Clock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{driveLabel}</p>
          <p className="text-xs text-muted-foreground">{totalDrivingTimeS ? 'Drive time' : 'Est. drive time'}</p>
        </div>
      </div>

      {skippedCount > 0 && (
        <p className="col-span-2 sm:col-span-3 text-sm text-warning-muted-foreground">
          {skippedCount} appointment{skippedCount > 1 ? 's' : ''} excluded — no location data.
        </p>
      )}
    </div>
  );
}

function StopCard({
  index,
  clientName,
  address,
  startTime,
  serviceName,
  status,
}: {
  index: number;
  clientName: string;
  address: string | null;
  startTime: string;
  serviceName: string;
  status: string;
}) {
  const timeLabel = format(parseISO(startTime), 'h:mm a');
  const navigateUrl = address ? buildMapsUrl(address) : null;

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info-muted text-info-muted-foreground',
    confirmed: 'bg-success-muted text-success-muted-foreground',
    in_progress: 'bg-warning-muted text-warning-muted-foreground',
  };

  return (
    <div className="flex gap-4 rounded-lg border bg-white p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {index}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">{serviceName}</p>
          </div>
          <Badge className={statusColor[status] ?? 'bg-secondary text-foreground'}>
            {status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {timeLabel}
          </span>
          {address && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{address}</span>
            </span>
          )}
        </div>
      </div>

      {navigateUrl && (
        <div className="flex-shrink-0">
          <a href={navigateUrl} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] min-w-[44px]"
              aria-label={`Navigate to ${clientName}`}
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

function LoadingSkeletons() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg border bg-white p-4">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RoutesPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [credits, setCredits] = useState<{ used: number; limit: number } | null>(null);

  const { data, isLoading, error } = useOptimizedRoute(selectedDate);

  useEffect(() => {
    fetchCreditUsage().then((c) => {
      if (c) setCredits(c);
    });
  }, [selectedDate]);

  const hasStops = data && data.stops.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Routes</h1>
          <p className="mt-2 text-muted-foreground">Optimized driving order for your appointments</p>
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="route-date" className="text-sm text-muted-foreground">
              Date
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="route-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 min-h-[44px]"
              />
            </div>
          </div>
          {credits && (
            <div
              className={`text-xs px-2 py-1 rounded ${
                credits.used / credits.limit > 0.95
                  ? 'bg-destructive/10 text-destructive'
                  : credits.used / credits.limit > 0.8
                    ? 'bg-warning-muted text-warning-muted-foreground'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {credits.used}/{credits.limit} API credits
            </div>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load route data. Try refreshing the page.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-info-muted p-2">
                <Route className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
            <LoadingSkeletons />
          </CardContent>
        </Card>
      ) : hasStops ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-info-muted p-2">
                <Route className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Optimized Route</CardTitle>
                  {data.source === 'graphhopper' ? (
                    <Badge className="bg-success-muted text-success-muted-foreground border-success-muted-foreground/20 text-xs">
                      Road-optimized
                    </Badge>
                  ) : (
                    <Badge className="bg-secondary text-muted-foreground border-border text-xs">
                      Estimated
                    </Badge>
                  )}
                  {data.efficiencyScore != null && data.efficiencyScore > 0 && (
                    <Badge className="bg-fern-pale text-primary border-primary/20 text-xs flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {data.efficiencyScore}% shorter
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <SummaryCard
              stopCount={data.stops.length}
              distanceKm={data.totalDistanceKm}
              totalDrivingTimeS={data.legDrivingTimesS.reduce((a, b) => a + b, 0) || undefined}
              skippedCount={data.skippedCount}
            />

            {/* Route Map */}
            <RouteMap
              stops={data.stops.map((stop, i) => ({
                id: stop.appointment.id,
                lat: stop.latitude,
                lon: stop.longitude,
                label: `${i + 1}. ${stop.client.first_name} ${stop.client.last_name}`,
                sublabel: `${stop.service.name} - ${format(parseISO(stop.appointment.start_time), 'h:mm a')}`,
              }))}
              polyline={data.polyline}
              legDrivingTimesS={data.legDrivingTimesS}
              legDistancesM={data.legDistancesM}
              className="h-[400px] w-full"
            />

            <div className="space-y-0">
              {data.stops.map((stop, i) => (
                <div key={stop.appointment.id}>
                  {i > 0 && (data.legDrivingTimesS[i] ?? 0) > 0 && (
                    <div className="flex items-center gap-2 py-2 pl-5 text-xs text-muted-foreground">
                      <Car className="h-3 w-3 flex-shrink-0" />
                      <span>{formatDriveTime(data.legDrivingTimesS[i]!)}</span>
                      {(data.legDistancesM[i] ?? 0) > 0 && (
                        <>
                          <span>·</span>
                          <span>{((data.legDistancesM[i]! / 1000) * 0.621371).toFixed(1)} mi</span>
                        </>
                      )}
                      <div className="flex-1 border-t border-dashed border-border" />
                    </div>
                  )}
                  {i > 0 && (data.legDrivingTimesS[i] ?? 0) === 0 && (
                    <div className="py-1" />
                  )}
                  <StopCard
                    index={i + 1}
                    clientName={`${stop.client.first_name} ${stop.client.last_name}`}
                    address={(stop.appointment.address ?? stop.client.address) ?? null}
                    startTime={stop.appointment.start_time}
                    serviceName={stop.service.name}
                    status={stop.appointment.status}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-info-muted p-2">
                <Route className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Route Optimization</CardTitle>
                <CardDescription>
                  {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="font-medium text-muted-foreground">No route to display</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {data?.skippedCount
                  ? `${data.skippedCount} appointment${data.skippedCount > 1 ? 's' : ''} found but none have location data. Add addresses to clients or appointments to enable route optimization.`
                  : 'No scheduled or confirmed appointments on this day. Add appointments to see your optimized route.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
