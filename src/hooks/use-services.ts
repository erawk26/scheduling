import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCollection } from '@erawk26/localkit/react';
import { app } from '@/lib/offlinekit';
import type { Service } from '@/lib/offlinekit/schema';
import type { ServiceFormData } from '@/lib/validations';

type WithMeta<T> = T & { _id: string; _deleted: boolean };

export function useServices() {
  const { data, isLoading, error } = useCollection(app.services);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data
      .filter((s) => !s._deleted)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return { data: filtered, isLoading, error };
}

export function useCreateService() {
  return useMutation({
    mutationFn: async (data: ServiceFormData): Promise<Service> => {
      const now = new Date().toISOString();
      const created = await app.services.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        name: data.name,
        description: data.description ?? null,
        duration_minutes: data.duration_minutes,
        price_cents: data.price_cents ?? null,
        weather_dependent: !!data.weather_dependent,
        location_type: data.location_type,
        created_at: now,
        updated_at: now,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 1,
        sync_operation: 'INSERT',
      });

      return created as unknown as Service;
    },
  });
}

export function useUpdateService() {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ServiceFormData>;
    }): Promise<Service> => {
      const all = await app.services.findMany() as WithMeta<Service>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) throw new Error(`Service ${id} not found`);

      const updated = await app.services.update(doc._id, {
        ...data,
        updated_at: new Date().toISOString(),
        needs_sync: 1,
        sync_operation: 'UPDATE',
      });

      return updated as unknown as Service;
    },
  });
}

export function useDeleteService() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const all = await app.services.findMany() as WithMeta<Service>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) return;
      await app.services.delete(doc._id);
    },
  });
}
