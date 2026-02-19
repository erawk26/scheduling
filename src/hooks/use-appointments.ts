/**
 * Appointments CRUD Hook - TanStack Query + SQLite (Kysely)
 *
 * Local-first operations with automatic sync queuing
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { v4 as uuidv4 } from 'uuid';
import { startOfDay, endOfDay } from 'date-fns';
import type { Appointment } from '@/lib/database/types';
import type { AppointmentFormData } from '@/lib/validations';

// TODO: Replace with actual auth session user ID
const TEMP_USER_ID = 'local-user';

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

  return useQuery({
    queryKey: ['appointments', options],
    queryFn: async (): Promise<Appointment[]> => {
      if (!db) throw new Error('Database not ready');

      let query = db
        .selectFrom('appointments')
        .selectAll()
        .where('user_id', '=', TEMP_USER_ID)
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
  });
}

/**
 * Convenience hook for today's appointments
 */
export function useTodayAppointments() {
  const today = new Date();
  const start = startOfDay(today).toISOString();
  const end = endOfDay(today).toISOString();

  return useAppointments({
    startDate: start,
    endDate: end,
  });
}

/**
 * Create a new appointment
 */
export function useCreateAppointment() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AppointmentFormData): Promise<Appointment> => {
      if (!db) throw new Error('Database not ready');

      const id = uuidv4();
      const now = new Date().toISOString();

      await db
        .insertInto('appointments')
        .values({
          id,
          user_id: TEMP_USER_ID,
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
  const { db } = useDatabase();
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
  const { db } = useDatabase();
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
  const { db } = useDatabase();
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
