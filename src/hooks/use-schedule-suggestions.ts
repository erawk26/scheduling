'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { useUserId } from '@/hooks/use-user-id';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { generateSuggestions } from '@/lib/schedule-intelligence/suggester';
import type { AnalysisAppointment, ScheduleSuggestion, WeeklySuggestions } from '@/lib/schedule-intelligence/types';

/**
 * Get schedule optimization suggestions for next week.
 */
export function useScheduleSuggestions() {
  const { db, isReady } = useDatabase();
  const userId = useUserId();

  return useQuery({
    queryKey: ['schedule-suggestions', userId],
    queryFn: async (): Promise<WeeklySuggestions | null> => {
      if (!db) throw new Error('Database not ready');

      const nextWeek = addWeeks(new Date(), 1);
      const weekStart = startOfWeek(nextWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(nextWeek, { weekStartsOn: 1 });

      const weekStartStr = format(weekStart, "yyyy-MM-dd'T'HH:mm:ss");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd'T'23:59:59");

      const appointments = await db
        .selectFrom('appointments')
        .selectAll()
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .where('start_time', '>=', weekStartStr)
        .where('start_time', '<=', weekEndStr)
        .where('status', 'in', ['scheduled', 'confirmed'])
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

      return generateSuggestions(appointmentsByDate);
    },
    enabled: isReady && !!db,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Apply a single schedule suggestion (updates appointment times in SQLite).
 */
export function useApplySuggestion() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestion: ScheduleSuggestion) => {
      if (!db) throw new Error('Database not ready');

      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

      await db
        .updateTable('appointments')
        .set({
          start_time: suggestion.newStartTime,
          end_time: suggestion.newEndTime,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', suggestion.appointmentId)
        .execute();

      return {
        appointmentId: suggestion.appointmentId,
        originalStartTime: suggestion.originalStartTime,
        originalEndTime: suggestion.originalEndTime,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-analysis'] });
    },
  });
}

/**
 * Apply all suggestions at once.
 */
export function useApplyAllSuggestions() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestions: ScheduleSuggestion[]) => {
      if (!db) throw new Error('Database not ready');

      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

      await Promise.all(
        suggestions.map((s) =>
          db
            .updateTable('appointments')
            .set({
              start_time: s.newStartTime,
              end_time: s.newEndTime,
              updated_at: now,
              needs_sync: 1,
              sync_operation: 'UPDATE',
            })
            .where('id', '=', s.appointmentId)
            .execute()
        )
      );

      return suggestions.map((s) => ({
        appointmentId: s.appointmentId,
        originalStartTime: s.originalStartTime,
        originalEndTime: s.originalEndTime,
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-analysis'] });
    },
  });
}

/**
 * Undo a previously applied suggestion by restoring original times.
 */
export function useUndoSuggestion() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      originalStartTime,
      originalEndTime,
    }: {
      appointmentId: string;
      originalStartTime: string;
      originalEndTime: string;
    }) => {
      if (!db) throw new Error('Database not ready');

      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

      await db
        .updateTable('appointments')
        .set({
          start_time: originalStartTime,
          end_time: originalEndTime,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', appointmentId)
        .execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-analysis'] });
    },
  });
}
