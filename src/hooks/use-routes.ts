/**
 * Route Hook - Fetches and optimizes today's (or a given day's) appointments
 *
 * Local-first: all computation runs in SQLite + optimizer, no network calls.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useDatabase } from '@/providers/database-provider';
import { useUserId } from '@/hooks/use-user-id';
import { optimizeRoute } from '@/lib/routes/optimizer';
import { fetchOptimizedRoute } from '@/lib/graphhopper/optimize';
import type { Appointment, Client, Service } from '@/lib/database/types';

export interface RouteAppointment {
  appointment: Appointment;
  client: Client;
  service: Service;
  latitude: number;
  longitude: number;
}

export interface OptimizedRouteResult {
  stops: RouteAppointment[];
  totalDistanceKm: number;
  skippedCount: number; // appointments without coordinates
  polyline?: string;           // encoded polyline from GraphHopper
  source: 'graphhopper' | 'local';  // which optimizer was used
}

/**
 * Fetches confirmed/scheduled appointments for a day and returns an optimized route.
 * @param date - ISO date string e.g. "2026-02-22"
 */
export function useOptimizedRoute(date: string) {
  const { db, isReady } = useDatabase();
  const userId = useUserId();

  return useQuery({
    queryKey: ['routes', date],
    queryFn: async (): Promise<OptimizedRouteResult> => {
      if (!db) throw new Error('Database not ready');

      const dayStart = format(startOfDay(parseISO(date)), "yyyy-MM-dd'T'HH:mm:ss");
      const dayEnd = format(endOfDay(parseISO(date)), "yyyy-MM-dd'T'HH:mm:ss");

      const appointments = await db
        .selectFrom('appointments')
        .selectAll()
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .where('start_time', '>=', dayStart)
        .where('start_time', '<=', dayEnd)
        .where('status', 'in', ['scheduled', 'confirmed', 'in_progress'])
        .orderBy('start_time', 'asc')
        .execute();

      if (appointments.length === 0) {
        return { stops: [], totalDistanceKm: 0, skippedCount: 0, source: 'local' as const };
      }

      const clientIds = [...new Set(appointments.map((a) => a.client_id))];
      const serviceIds = [...new Set(appointments.map((a) => a.service_id))];

      const [clients, services] = await Promise.all([
        db
          .selectFrom('clients')
          .selectAll()
          .where('id', 'in', clientIds)
          .execute(),
        db
          .selectFrom('services')
          .selectAll()
          .where('id', 'in', serviceIds)
          .execute(),
      ]);

      const clientMap = new Map(clients.map((c) => [c.id, c]));
      const serviceMap = new Map(services.map((s) => [s.id, s]));

      const geocoded: RouteAppointment[] = [];
      let skippedCount = 0;

      for (const appt of appointments) {
        const client = clientMap.get(appt.client_id);
        const service = serviceMap.get(appt.service_id);
        if (!client || !service) continue;

        const lat = appt.latitude ?? client.latitude;
        const lon = appt.longitude ?? client.longitude;

        if (lat == null || lon == null) {
          skippedCount++;
          continue;
        }

        geocoded.push({ appointment: appt, client, service, latitude: lat, longitude: lon });
      }

      const optimized = optimizeRoute(
        geocoded.map((s) => ({ ...s, id: s.appointment.id }))
      );

      const localResult = {
        stops: optimized.stops,
        totalDistanceKm: optimized.totalDistanceKm,
        skippedCount,
        source: 'local' as const,
      };

      // Try API optimization (non-blocking fallback to local)
      try {
        const apiResult = await fetchOptimizedRoute({
          stops: geocoded.map((s) => ({
            id: s.appointment.id,
            lat: s.latitude,
            lon: s.longitude,
            duration_minutes: s.service.duration_minutes,
          })),
        });

        if (apiResult && apiResult.stops.length > 0) {
          const stopMap = new Map(geocoded.map((s) => [s.appointment.id, s]));
          const reordered = apiResult.stops
            .map((s) => stopMap.get(s.id))
            .filter((s): s is RouteAppointment => !!s);

          return {
            stops: reordered,
            totalDistanceKm: apiResult.totalDistanceM / 1000,
            skippedCount,
            polyline: apiResult.polyline,
            source: 'graphhopper' as const,
          };
        }
      } catch {
        // API failed, use local fallback (already computed)
      }

      return localResult;
    },
    enabled: isReady && !!db && !!date,
  });
}
