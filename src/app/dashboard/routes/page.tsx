'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { format, parseISO } from 'date-fns';
import { Navigation, MapPin, Clock, Route, Car, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOptimizedRoute } from '@/hooks/use-routes';
import { fetchCreditUsage } from '@/lib/graphhopper/optimize';

const RouteMap = dynamic(
  () => import('@/components/routes/route-map').then((m) => ({ default: m.RouteMap })),
  { ssr: false, loading: () => <Skeleton className="h-[400px] w-full rounded-lg" /> }
);

const KM_TO_MILES = 0.621371;
const AVG_SPEED_MPH = 30;

function toMiles(km: number): string {
  return (km * KM_TO_MILES).toFixed(1);
}

function estimateDriveMinutes(km: number): number {
  return Math.round((km * KM_TO_MILES) / AVG_SPEED_MPH * 60);
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
  skippedCount,
}: {
  stopCount: number;
  distanceKm: number;
  skippedCount: number;
}) {
  const driveMin = estimateDriveMinutes(distanceKm);
  const driveHours = Math.floor(driveMin / 60);
  const driveRem = driveMin % 60;
  const driveLabel =
    driveHours > 0 ? `${driveHours}h ${driveRem}m` : `${driveRem}m`;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
        <div className="rounded-lg bg-blue-100 p-2">
          <MapPin className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{stopCount}</p>
          <p className="text-xs text-gray-500">Stops</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
        <div className="rounded-lg bg-green-100 p-2">
          <Car className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{toMiles(distanceKm)}</p>
          <p className="text-xs text-gray-500">Est. miles</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-white p-4 col-span-2 sm:col-span-1">
        <div className="rounded-lg bg-purple-100 p-2">
          <Clock className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{driveLabel}</p>
          <p className="text-xs text-gray-500">Est. drive time</p>
        </div>
      </div>

      {skippedCount > 0 && (
        <p className="col-span-2 sm:col-span-3 text-sm text-amber-600">
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
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="flex gap-4 rounded-lg border bg-white p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
        {index}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900">{clientName}</p>
            <p className="text-sm text-gray-500">{serviceName}</p>
          </div>
          <Badge className={statusColor[status] ?? 'bg-gray-100 text-gray-700'}>
            {status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
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
          <h1 className="text-3xl font-bold text-gray-900">Routes</h1>
          <p className="mt-2 text-gray-600">Optimized driving order for your appointments</p>
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="route-date" className="text-sm text-gray-600">
              Date
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
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
                  ? 'bg-red-100 text-red-700'
                  : credits.used / credits.limit > 0.8
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {credits.used}/{credits.limit} API credits
            </div>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700">
              Failed to load route data. Try refreshing the page.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <Route className="h-5 w-5 text-blue-600" />
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
              <div className="rounded-lg bg-blue-100 p-2">
                <Route className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Optimized Route</CardTitle>
                  {data.source === 'graphhopper' ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                      Road-optimized
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                      Estimated
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
              className="h-[400px] w-full"
            />

            <div className="space-y-3">
              {data.stops.map((stop, i) => (
                <StopCard
                  key={stop.appointment.id}
                  index={i + 1}
                  clientName={`${stop.client.first_name} ${stop.client.last_name}`}
                  address={stop.appointment.address ?? stop.client.address}
                  startTime={stop.appointment.start_time}
                  serviceName={stop.service.name}
                  status={stop.appointment.status}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <Route className="h-5 w-5 text-blue-600" />
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
              <MapPin className="mb-4 h-16 w-16 text-gray-300" />
              <p className="font-medium text-gray-500">No route to display</p>
              <p className="mt-2 max-w-sm text-sm text-gray-400">
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
