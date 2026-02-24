'use client';

import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { useUserId } from '@/hooks/use-user-id';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { analyzeWeekEfficiency } from '@/lib/schedule-intelligence/analyzer';
import type { AnalysisAppointment, WeeklyEfficiency } from '@/lib/schedule-intelligence/types';

/**
 * Analyze a past week's route efficiency.
 * @param weeksAgo - 1 means last week, 2 means two weeks ago, etc.
 */
export function useWeeklyAnalysis(weeksAgo: number = 1) {
  const { db, isReady } = useDatabase();
  const userId = useUserId();

  return useQuery({
    queryKey: ['schedule-analysis', weeksAgo, userId],
    queryFn: async (): Promise<WeeklyEfficiency | null> => {
      if (!db) throw new Error('Database not ready');

      const targetWeek = subWeeks(new Date(), weeksAgo);
      const weekStart = startOfWeek(targetWeek, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 1 }); // Sunday

      const weekStartStr = format(weekStart, "yyyy-MM-dd'T'HH:mm:ss");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd'T'23:59:59");
      const weekStartDate = format(weekStart, 'yyyy-MM-dd');

      const appointments = await db
        .selectFrom('appointments')
        .selectAll()
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .where('start_time', '>=', weekStartStr)
        .where('start_time', '<=', weekEndStr)
        .where('status', 'in', ['scheduled', 'confirmed', 'completed'])
        .orderBy('start_time', 'asc')
        .execute();

      if (appointments.length === 0) return null;

      const clientIds = [...new Set(appointments.map((a) => a.client_id))];
      const serviceIds = [...new Set(appointments.map((a) => a.service_id))];

      const [clients, services] = await Promise.all([
        db.selectFrom('clients').selectAll().where('id', 'in', clientIds).execute(),
        db.selectFrom('services').selectAll().where('id', 'in', serviceIds).execute(),
      ]);

      const clientMap = new Map(clients.map((c) => [c.id, c]));
      const serviceMap = new Map(services.map((s) => [s.id, s]));

      const appointmentsByDate = new Map<string, AnalysisAppointment[]>();

      for (const appt of appointments) {
        const client = clientMap.get(appt.client_id);
        const service = serviceMap.get(appt.service_id);
        if (!client || !service) continue;

        const lat = appt.latitude ?? client.latitude ?? 0;
        const lon = appt.longitude ?? client.longitude ?? 0;

        const date = format(parseISO(appt.start_time), 'yyyy-MM-dd');
        const existing = appointmentsByDate.get(date) ?? [];

        existing.push({
          id: appt.id,
          clientId: appt.client_id,
          clientName: `${client.first_name} ${client.last_name}`,
          serviceId: appt.service_id,
          serviceName: service.name,
          startTime: appt.start_time,
          endTime: appt.end_time,
          durationMinutes: service.duration_minutes,
          latitude: lat,
          longitude: lon,
          flexibility: client.scheduling_flexibility,
        });

        appointmentsByDate.set(date, existing);
      }

      return analyzeWeekEfficiency(weekStartDate, appointmentsByDate);
    },
    enabled: isReady && !!db,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
