'use client';

import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCollection } from '@erawk26/localkit/react';
import { startOfDay, endOfDay } from 'date-fns';
import { app } from '@/lib/offlinekit';
import type { Appointment } from '@/lib/offlinekit/schema';
import type { AppointmentFormData } from '@/lib/validations';

type WithMeta<T> = T & { _id: string; _deleted: boolean };
import { geocodeAddress } from '@/lib/graphhopper/geocode';

interface UseAppointmentsOptions {
  startDate?: string;
  endDate?: string;
  status?: string;
}

export function useAppointments(options?: UseAppointmentsOptions) {
  const { data, isLoading, error } = useCollection(app.appointments);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.filter((a) => !a._deleted);

    if (options?.startDate) {
      result = result.filter((a) => a.start_time >= options.startDate!);
    }
    if (options?.endDate) {
      result = result.filter((a) => a.start_time <= options.endDate!);
    }
    if (options?.status) {
      result = result.filter((a) => a.status === options.status);
    }

    return result.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [data, options?.startDate, options?.endDate, options?.status]);

  return { data: filtered, isLoading, error };
}

export function useTodayAppointments() {
  const start = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const end = useMemo(() => endOfDay(new Date()).toISOString(), []);
  return useAppointments({ startDate: start, endDate: end });
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: async (data: AppointmentFormData): Promise<Appointment> => {
      const now = new Date().toISOString();
      const created = await app.appointments.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
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
        synced_at: null,
        deleted_at: null,
        needs_sync: 1,
        sync_operation: 'INSERT',
      });

      if (data.address) {
        geocodeAddress(data.address)
          .then(async (geo) => {
            if (!geo) return;
            await app.appointments
              .update(created._id, {
                latitude: geo.lat,
                longitude: geo.lon,
                updated_at: new Date().toISOString(),
              })
              .catch(() => undefined);
          })
          .catch(() => undefined);
      }

      return created as unknown as Appointment;
    },
  });
}

export function useUpdateAppointment() {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AppointmentFormData>;
    }): Promise<Appointment> => {
      const all = await app.appointments.findMany() as WithMeta<Appointment>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) throw new Error(`Appointment ${id} not found`);

      const updated = await app.appointments.update(doc._id, {
        ...data,
        updated_at: new Date().toISOString(),
        needs_sync: 1,
        sync_operation: 'UPDATE',
      });

      if (data.address) {
        geocodeAddress(data.address)
          .then(async (geo) => {
            if (!geo) return;
            await app.appointments
              .update(doc._id, {
                latitude: geo.lat,
                longitude: geo.lon,
                updated_at: new Date().toISOString(),
              })
              .catch(() => undefined);
          })
          .catch(() => undefined);
      }

      return updated as unknown as Appointment;
    },
  });
}

export function useUpdateAppointmentStatus() {
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Appointment['status'];
    }): Promise<Appointment> => {
      const all = await app.appointments.findMany() as WithMeta<Appointment>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) throw new Error(`Appointment ${id} not found`);

      const updated = await app.appointments.update(doc._id, {
        status,
        updated_at: new Date().toISOString(),
        needs_sync: 1,
        sync_operation: 'UPDATE',
      });

      return updated as unknown as Appointment;
    },
  });
}

export function useDeleteAppointment() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const all = await app.appointments.findMany() as WithMeta<Appointment>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) return;
      await app.appointments.delete(doc._id);
    },
  });
}
