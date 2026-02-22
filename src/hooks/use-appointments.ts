/**
 * Appointments CRUD Hook - TanStack Query + SQLite (Kysely)
 *
 * Local-first operations with automatic sync queuing
 */

'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { useUserId } from '@/hooks/use-user-id';
import { v4 as uuidv4 } from 'uuid';
import { startOfDay, endOfDay } from 'date-fns';
import type { Appointment } from '@/lib/database/types';
import type { AppointmentFormData } from '@/lib/validations';

interface UseAppointmentsOptions {
  startDate?: string;
  endDate?: string;
  status?: string;
}

type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * Query appointments with optional filters
 */
export function useAppointments(options?: UseAppointmentsOptions) {
  const { db, isReady } = useDatabase();
  const userId = useUserId();

  return useQuery({
    queryKey: ['appointments', options],
    queryFn: async (): Promise<Appointment[]> => {
      if (!db) throw new Error('Database not ready');

      let query = db
        .selectFrom('appointments')
        .selectAll()
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null);

      // Apply date filters
      if (options?.startDate) {
        query = query.where('start_time', '>=', options.startDate);
      }
      if (options?.endDate) {
        query = query.where('start_time', '<=', options.endDate);
      }

      // Apply status filter
      if (options?.status) {
        query = query.where(
          'status',
          '=',
          options.status as AppointmentStatus
        );
      }

      const appointments = await query
        .orderBy('start_time', 'asc')
        .execute();

      return appointments;
    },
    enabled: isReady && !!db,
    placeholderData: keepPreviousData,
  });
}

/**
 * Convenience hook for today's appointments
 */
export function useTodayAppointments() {
  const start = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const end = useMemo(() => endOfDay(new Date()).toISOString(), []);

  return useAppointments({
    startDate: start,
    endDate: end,
  });
}

/**
 * Create a new appointment
 */
export function useCreateAppointment() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (data: AppointmentFormData): Promise<Appointment> => {
      if (!db) throw new Error('Database not ready');

      const id = uuidv4();
      const now = new Date().toISOString();

      await db
        .insertInto('appointments')
        .values({
          id,
          user_id: userId,
          client_id: data.client_id,
          pet_id: data.pet_id ?? null,
          service_id: data.service_id,
          start_time: data.start_time,
          end_time: data.end_time,
          status: data.status,
          location_type: data.location_type,
          address: data.address ?? null,
          latitude: null,
          longitude: null,
          notes: data.notes ?? null,
          internal_notes: data.internal_notes ?? null,
          weather_alert: 0,
          created_at: now,
          updated_at: now,
          version: 1,
          needs_sync: 1,
          sync_operation: 'INSERT',
          synced_at: null,
          deleted_at: null,
        })
        .execute();

      // Return created appointment
      const appointment = await db
        .selectFrom('appointments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      syncEngine?.queueMutation('appointments', 'CREATE', id, appointment);

      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Update an existing appointment
 */
export function useUpdateAppointment() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AppointmentFormData>;
    }): Promise<Appointment> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('appointments')
        .set({
          ...data,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', id)
        .execute();

      // Return updated appointment
      const appointment = await db
        .selectFrom('appointments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      syncEngine?.queueMutation('appointments', 'UPDATE', id, appointment);

      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Update appointment status only (convenience mutation)
 */
export function useUpdateAppointmentStatus() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AppointmentStatus;
    }): Promise<Appointment> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('appointments')
        .set({
          status,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', id)
        .execute();

      // Return updated appointment
      const appointment = await db
        .selectFrom('appointments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      syncEngine?.queueMutation('appointments', 'UPDATE', id, appointment);

      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Soft delete an appointment
 */
export function useDeleteAppointment() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('appointments')
        .set({
          deleted_at: now,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'DELETE',
        })
        .where('id', '=', id)
        .execute();

      syncEngine?.queueMutation('appointments', 'DELETE', id, { id, deleted_at: now });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
