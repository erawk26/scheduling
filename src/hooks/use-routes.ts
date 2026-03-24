'use client';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { app } from '@/lib/offlinekit';
import { optimizeRoute } from '@/lib/routes/optimizer';
import { fetchOptimizedRoute } from '@/lib/graphhopper/optimize';
import type { Appointment, Client, Service } from '@/lib/offlinekit/schema';

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
  skippedCount: number;
  polyline?: string;
  source: 'graphhopper' | 'local';
}

export function useOptimizedRoute(date: string) {
  return useQuery({
    queryKey: ['routes', date],
    queryFn: async (): Promise<OptimizedRouteResult> => {
      const dayStart = format(startOfDay(parseISO(date)), "yyyy-MM-dd'T'HH:mm:ss");
      const dayEnd = format(endOfDay(parseISO(date)), "yyyy-MM-dd'T'HH:mm:ss");

      type WM<T> = T & { _id: string; _deleted: boolean };
      const [allAppointments, allClients, allServices] = await Promise.all([
        app.appointments.findMany() as Promise<WM<Appointment>[]>,
        app.clients.findMany() as Promise<WM<Client>[]>,
        app.services.findMany() as Promise<WM<Service>[]>,
      ]);

      const appointments = allAppointments.filter(
        (a) =>
          !a._deleted &&
          a.start_time >= dayStart &&
          a.start_time <= dayEnd &&
          ['scheduled', 'confirmed', 'in_progress'].includes(a.status)
      ).sort((a, b) => a.start_time.localeCompare(b.start_time));

      if (appointments.length === 0) {
        return { stops: [], totalDistanceKm: 0, skippedCount: 0, source: 'local' };
      }

      const clientMap = new Map(allClients.map((c) => [c.id, c]));
      const serviceMap = new Map(allServices.map((s) => [s.id, s]));

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

        geocoded.push({
          appointment: appt as unknown as Appointment,
          client: client as unknown as Client,
          service: service as unknown as Service,
          latitude: lat,
          longitude: lon,
        });
      }

      const optimized = optimizeRoute(
        geocoded.map((s) => ({ ...s, id: s.appointment.id }))
      );

      const localResult: OptimizedRouteResult = {
        stops: optimized.stops,
        totalDistanceKm: optimized.totalDistanceKm,
        skippedCount,
        source: 'local',
      };

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
            source: 'graphhopper',
          };
        }
      } catch {
        // API failed, use local fallback
      }

      return localResult;
    },
    enabled: !!date,
  });
}
